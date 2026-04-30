import { z } from "zod";
import { InvalidInputError } from "../errors";
import type { CTGovClient } from "../ctgov/client";
import type { SearchResult } from "../ctgov/types";

export const searchTrialsInputSchema = z.object({
  condition: z.string().min(1, "condition is required"),
  location: z.string().optional(),
  radiusMiles: z
    .number()
    .min(1, "radiusMiles must be between 1 and 500")
    .max(500, "radiusMiles must be between 1 and 500")
    .optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.enum(["recruiting", "not_yet_recruiting", "any"]).default("recruiting"),
  phase: z.enum(["1", "2", "3", "4", "any"]).default("any"),
  pageSize: z.number().int().min(1).max(25).default(10),
  pageToken: z.string().optional(),
});

export type SearchTrialsInput = z.infer<typeof searchTrialsInputSchema>;

export async function searchTrialsTool(
  rawInput: unknown,
  client: CTGovClient
): Promise<SearchResult> {
  const parsed = searchTrialsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return client.searchStudies(parsed.data);
}

export const SEARCH_TRIALS_DESCRIPTION = `Search ClinicalTrials.gov for trials matching a condition. Defaults to currently recruiting trials only. Accepts an optional free-form location string (e.g. "Denver, CO", "Texas", "80202"), optional radiusMiles for U.S. ZIP-code radius searches (e.g. location "80202" with radiusMiles 50), optional latitude/longitude with radiusMiles when exact coordinates are already known, and an optional phase ("1"-"4" or "any"). Returns up to pageSize trials (max 25). Radius searches include nearestSiteMiles on each trial when site coordinates are available.

PAGINATION: The response includes a nextPageToken. If the user wants more results, call search_trials again with the SAME condition/location/radiusMiles/latitude/longitude/status/phase plus pageToken=<that nextPageToken>. A null nextPageToken means there are no more pages.

ALWAYS surface the lastUpdated field when presenting a trial — data can lag reality by weeks. Include the officialUrl in your response so the user can verify on ClinicalTrials.gov.`;
