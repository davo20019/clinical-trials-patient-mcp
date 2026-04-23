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

  async searchStudies(_params: SearchParams): Promise<SearchResult> {
    throw new Error("not implemented");
  }

  async getStudy(_nctId: string): Promise<TrialDetails> {
    throw new Error("not implemented");
  }

  async listConditions(_query: string): Promise<ConditionMatch[]> {
    throw new Error("not implemented");
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

export const BASE_URL = BASE;
export { InvalidInputError, NotFoundError, UpstreamError };
