import { CachedFetcher } from "./cache";
import { InvalidInputError, NotFoundError, UpstreamError } from "../errors";
import type {
  TrialSummary,
  TrialDetails,
  ConditionMatch,
  SearchResult,
  SearchParams,
} from "./types";

const BASE = "https://clinicaltrials.gov/api/v2";

export interface CTGovClientOptions {
  fetcher: CachedFetcher;
}

export class CTGovClient {
  private readonly fetcher: CachedFetcher;

  constructor(opts: CTGovClientOptions) {
    this.fetcher = opts.fetcher;
  }

  async searchStudies(params: SearchParams): Promise<SearchResult> {
    if (!params.condition || !params.condition.trim()) {
      throw new InvalidInputError("`condition` is required.");
    }
    const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 25);
    const status = params.status ?? "recruiting";
    const phase = params.phase ?? "any";

    const qs = new URLSearchParams();
    qs.set("query.cond", params.condition.trim());
    if (params.location) qs.set("query.locn", params.location.trim());
    const statusValues = STATUS_MAP[status];
    if (statusValues.length > 0) {
      qs.set("filter.overallStatus", statusValues.join(","));
    }
    const phaseValues = PHASE_MAP[phase];
    if (phaseValues && phaseValues.length > 0) {
      qs.set("filter.phase", phaseValues.join(","));
    }
    qs.set("pageSize", String(pageSize));
    qs.set("countTotal", "true");
    if (params.pageToken) qs.set("pageToken", params.pageToken);

    const url = `${BASE}/studies?${qs.toString()}`;
    const raw = await this.fetcher.getJson<RawSearchResponse>(url);

    return {
      totalCount: raw.totalCount ?? raw.studies.length,
      trials: raw.studies.map(mapRawStudyToSummary),
      nextPageToken: raw.nextPageToken ?? null,
    };
  }

  async getStudy(nctId: string): Promise<TrialDetails> {
    validateNctId(nctId);
    const url = `${BASE}/studies/${nctId}`;
    let raw: RawStudy;
    try {
      raw = await this.fetcher.getJson<RawStudy>(url);
    } catch (e) {
      if (e instanceof UpstreamError && /\b404\b/.test(e.message)) {
        throw new NotFoundError(`No trial found with ID ${nctId}.`);
      }
      throw e;
    }
    if (!raw?.protocolSection?.identificationModule?.nctId) {
      throw new NotFoundError(`No trial found with ID ${nctId}.`);
    }
    return mapRawStudyToDetails(raw);
  }

  async listConditions(query: string): Promise<ConditionMatch[]> {
    if (!query || !query.trim()) {
      throw new InvalidInputError("`query` is required.");
    }
    const qs = new URLSearchParams();
    qs.set("query.cond", query.trim());
    qs.set("pageSize", "100");
    qs.set("fields", "protocolSection.conditionsModule.conditions");
    const url = `${BASE}/studies?${qs.toString()}`;
    const raw = await this.fetcher.getJson<RawSearchResponse>(url);

    const counts = new Map<string, number>();
    for (const study of raw.studies ?? []) {
      const conds = study.protocolSection?.conditionsModule?.conditions ?? [];
      for (const c of conds) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }

    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([condition, studyCount]) => ({
        condition,
        synonyms: [], // v1: no synonym resolution
        studyCount,
      }));

    return sorted;
  }
}

export const PHASE_MAP: Record<string, string[]> = {
  "1": ["PHASE1", "EARLY_PHASE1", "PHASE1/PHASE2"],
  "2": ["PHASE2", "PHASE1/PHASE2", "PHASE2/PHASE3"],
  "3": ["PHASE3", "PHASE2/PHASE3"],
  "4": ["PHASE4"],
};

export const STATUS_MAP: Record<string, string[]> = {
  recruiting: ["RECRUITING"],
  not_yet_recruiting: ["NOT_YET_RECRUITING"],
  any: [],
};

export function buildOfficialUrl(nctId: string): string {
  return `https://clinicaltrials.gov/study/${nctId}`;
}

export function validateNctId(nctId: string): void {
  if (!/^NCT\d{8}$/.test(nctId)) {
    throw new InvalidInputError(
      `Invalid NCT ID: "${nctId}" (expected format: NCT followed by 8 digits).`
    );
  }
}

interface RawSearchResponse {
  studies: RawStudy[];
  totalCount?: number;
  nextPageToken?: string;
}

interface RawStudy {
  protocolSection: {
    identificationModule?: {
      nctId: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      lastUpdatePostDateStruct?: { date?: string };
      startDateStruct?: { date?: string };
      completionDateStruct?: { date?: string };
    };
    descriptionModule?: {
      briefSummary?: string;
      detailedDescription?: string;
    };
    designModule?: {
      phases?: string[];
      studyType?: string;
      enrollmentInfo?: { count?: number };
      designInfo?: { allocation?: string };
    };
    conditionsModule?: { conditions?: string[] };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
      collaborators?: Array<{ name?: string }>;
    };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        state?: string;
        country?: string;
        status?: string;
        contacts?: Array<{
          name?: string;
          phone?: string;
          email?: string;
          role?: string;
        }>;
      }>;
    };
    eligibilityModule?: {
      minimumAge?: string;
      maximumAge?: string;
      sex?: string;
      healthyVolunteers?: boolean;
      eligibilityCriteria?: string;
    };
    armsInterventionsModule?: {
      interventions?: Array<{
        type?: string;
        name?: string;
        description?: string;
      }>;
    };
    referencesModule?: {
      references?: Array<{ pmid?: string }>;
    };
  };
}

function mapRawStudyToSummary(raw: RawStudy): TrialSummary {
  const p = raw.protocolSection;
  const id = p.identificationModule;
  const nctId = id?.nctId ?? "";
  return {
    nctId,
    title: id?.briefTitle ?? "",
    briefSummary: p.descriptionModule?.briefSummary ?? "",
    phase: p.designModule?.phases?.[0] ?? null,
    status: p.statusModule?.overallStatus ?? "",
    conditions: p.conditionsModule?.conditions ?? [],
    locations: (p.contactsLocationsModule?.locations ?? []).map((loc) => ({
      facility: loc.facility ?? "",
      city: loc.city ?? "",
      state: loc.state ?? null,
      country: loc.country ?? "",
      recruitingStatus: loc.status ?? null,
      contacts: (loc.contacts ?? []).map((c) => ({
        name: c.name ?? null,
        phone: c.phone ?? null,
        email: c.email ?? null,
        role: c.role ?? null,
      })),
    })),
    sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? "",
    lastUpdated: p.statusModule?.lastUpdatePostDateStruct?.date ?? "",
    officialUrl: buildOfficialUrl(nctId),
  };
}

// Used by Task 7.
export function mapRawStudyToDetails(raw: RawStudy): import("./types").TrialDetails {
  const p = raw.protocolSection;
  const id = p.identificationModule;
  const nctId = id?.nctId ?? "";
  return {
    identification: {
      nctId,
      title: id?.briefTitle ?? "",
      officialTitle: id?.officialTitle ?? "",
    },
    summary: {
      briefSummary: p.descriptionModule?.briefSummary ?? "",
      detailedDescription: p.descriptionModule?.detailedDescription ?? null,
    },
    status: {
      overallStatus: p.statusModule?.overallStatus ?? "",
      startDate: p.statusModule?.startDateStruct?.date ?? null,
      completionDate: p.statusModule?.completionDateStruct?.date ?? null,
      lastUpdated: p.statusModule?.lastUpdatePostDateStruct?.date ?? "",
    },
    design: {
      phase: p.designModule?.phases?.[0] ?? null,
      studyType: p.designModule?.studyType ?? "",
      enrollmentCount: p.designModule?.enrollmentInfo?.count ?? null,
      allocation: p.designModule?.designInfo?.allocation ?? null,
    },
    eligibility: {
      minimumAge: p.eligibilityModule?.minimumAge ?? null,
      maximumAge: p.eligibilityModule?.maximumAge ?? null,
      sex: p.eligibilityModule?.sex ?? "",
      healthyVolunteers: p.eligibilityModule?.healthyVolunteers ?? false,
      criteria: p.eligibilityModule?.eligibilityCriteria ?? "",
    },
    locations: (p.contactsLocationsModule?.locations ?? []).map((loc) => ({
      facility: loc.facility ?? "",
      city: loc.city ?? "",
      state: loc.state ?? null,
      country: loc.country ?? "",
      recruitingStatus: loc.status ?? null,
      contacts: (loc.contacts ?? []).map((c) => ({
        name: c.name ?? null,
        phone: c.phone ?? null,
        email: c.email ?? null,
        role: c.role ?? null,
      })),
    })),
    sponsor: {
      leadSponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? "",
      collaborators: (p.sponsorCollaboratorsModule?.collaborators ?? [])
        .map((c) => c.name ?? "")
        .filter(Boolean),
    },
    interventions: (p.armsInterventionsModule?.interventions ?? []).map((i) => ({
      type: i.type ?? "",
      name: i.name ?? "",
      description: i.description ?? null,
    })),
    references: {
      pubmedIds: (p.referencesModule?.references ?? [])
        .map((r) => r.pmid ?? "")
        .filter(Boolean),
      officialUrl: buildOfficialUrl(nctId),
    },
  };
}

// Used by Task 8.
export type { RawStudy, RawSearchResponse };

export const BASE_URL = BASE;
export { InvalidInputError, NotFoundError, UpstreamError };
