import { z } from "zod";
import { InvalidInputError } from "../errors";
import type { CTGovClient } from "../ctgov/client";

export const parseEligibilityInputSchema = z
  .object({
    nctId: z
      .string()
      .regex(/^NCT\d{8}$/, "nctId must look like NCT followed by 8 digits")
      .optional(),
    criteriaText: z.string().min(1).optional(),
  })
  .refine(
    (v) => !!v.nctId || !!v.criteriaText,
    "Provide either nctId or criteriaText"
  );

export type ParseEligibilityInput = z.infer<typeof parseEligibilityInputSchema>;

export interface ParsedEligibility {
  inclusion: string[];
  exclusion: string[];
  ageMinYears: number | null;
  ageMaxYears: number | null;
  sex: "ALL" | "MALE" | "FEMALE";
  healthyVolunteers: boolean;
  unstructured: string;
  source: {
    nctId: string | null;
    lastUpdated: string | null;
  };
}

export async function parseEligibilityCriteriaTool(
  rawInput: unknown,
  client: CTGovClient
): Promise<ParsedEligibility> {
  const parsed = parseEligibilityInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const input = parsed.data;

  let criteriaText: string;
  let ageMin: number | null = null;
  let ageMax: number | null = null;
  let sex: "ALL" | "MALE" | "FEMALE" = "ALL";
  let healthyVolunteers = false;
  let sourceNct: string | null = null;
  let sourceLastUpdated: string | null = null;

  if (input.nctId) {
    const details = await client.getStudy(input.nctId);
    criteriaText = details.eligibility.criteria;
    ageMin = parseAgeToYears(details.eligibility.minimumAge);
    ageMax = parseAgeToYears(details.eligibility.maximumAge);
    sex = normalizeSex(details.eligibility.sex);
    healthyVolunteers = details.eligibility.healthyVolunteers;
    sourceNct = details.identification.nctId;
    sourceLastUpdated = details.status.lastUpdated;
  } else {
    criteriaText = input.criteriaText!;
  }

  const split = splitInclusionExclusion(criteriaText);

  return {
    inclusion: split.inclusion,
    exclusion: split.exclusion,
    ageMinYears: ageMin,
    ageMaxYears: ageMax,
    sex,
    healthyVolunteers,
    unstructured: split.unstructured,
    source: { nctId: sourceNct, lastUpdated: sourceLastUpdated },
  };
}

export function splitInclusionExclusion(text: string): {
  inclusion: string[];
  exclusion: string[];
  unstructured: string;
} {
  const incMatch = text.match(/inclusion\s+criteria\s*:?/i);
  const excMatch = text.match(/exclusion\s+criteria\s*:?/i);
  const incIdx = incMatch?.index ?? -1;
  const excIdx = excMatch?.index ?? -1;

  let inclusionSection = "";
  let exclusionSection = "";
  const unstructuredParts: string[] = [];

  if (incIdx !== -1 && excIdx !== -1 && excIdx > incIdx) {
    unstructuredParts.push(text.slice(0, incIdx).trim());
    inclusionSection = text.slice(incIdx + incMatch![0].length, excIdx);
    exclusionSection = text.slice(excIdx + excMatch![0].length);
  } else if (incIdx !== -1 && excIdx !== -1 && excIdx < incIdx) {
    unstructuredParts.push(text.slice(0, excIdx).trim());
    exclusionSection = text.slice(excIdx + excMatch![0].length, incIdx);
    inclusionSection = text.slice(incIdx + incMatch![0].length);
  } else if (incIdx !== -1) {
    unstructuredParts.push(text.slice(0, incIdx).trim());
    inclusionSection = text.slice(incIdx + incMatch![0].length);
  } else if (excIdx !== -1) {
    unstructuredParts.push(text.slice(0, excIdx).trim());
    exclusionSection = text.slice(excIdx + excMatch![0].length);
  } else {
    unstructuredParts.push(text.trim());
  }

  return {
    inclusion: splitBullets(inclusionSection),
    exclusion: splitBullets(exclusionSection),
    unstructured: unstructuredParts.filter(Boolean).join("\n\n").trim(),
  };
}

function splitBullets(section: string): string[] {
  if (!section || !section.trim()) return [];
  const items = section.split(/(?:^|\n)\s*(?:[*•\-]|\d+[.)])\s+/);
  return items
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

export function parseAgeToYears(age: string | null): number | null {
  if (!age) return null;
  const m = age.match(/(\d+(?:\.\d+)?)\s*(year|month|week|day)s?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("year")) return n;
  if (unit.startsWith("month")) return Math.round((n / 12) * 100) / 100;
  if (unit.startsWith("week")) return Math.round((n / 52) * 100) / 100;
  if (unit.startsWith("day")) return Math.round((n / 365) * 100) / 100;
  return null;
}

function normalizeSex(value: string): "ALL" | "MALE" | "FEMALE" {
  const v = value.toUpperCase();
  if (v === "MALE" || v === "FEMALE") return v;
  return "ALL";
}

export const PARSE_ELIGIBILITY_DESCRIPTION = `Turn a trial's free-text eligibility criteria into structured inclusion/exclusion lists, age limits, and sex requirements. Call this with EITHER an nctId (we'll fetch the trial) OR raw criteriaText (for trials you've already fetched).

Use the structured output to present the criteria to the user as two clear lists (inclusion / exclusion), then ask them targeted questions about each point so they can assess fit. Quote the criteria verbatim to the user — do NOT paraphrase.

PRIVACY — IMPORTANT FOR HOW YOU USE THIS TOOL: never send the user's own health information BACK to this tool. This tool does not accept patient profiles, and this server does not store anything. The matching of user → criteria happens in YOUR conversation, not here.`;
