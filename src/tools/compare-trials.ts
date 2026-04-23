import { z } from "zod";
import { InvalidInputError, NotFoundError } from "../errors";
import type { CTGovClient } from "../ctgov/client";
import type { TrialDetails } from "../ctgov/types";

export const compareTrialsInputSchema = z.object({
  nctIds: z
    .array(z.string().regex(/^NCT\d{8}$/, "Each nctId must look like NCT followed by 8 digits"))
    .min(2, "Provide at least 2 NCT IDs to compare")
    .max(5, "Compare at most 5 trials at a time"),
});

export type CompareTrialsInput = z.infer<typeof compareTrialsInputSchema>;

export interface CompareTrialsOutput {
  trials: Record<string, TrialDetails>;
  failed: Array<{ nctId: string; reason: string }>;
}

export async function compareTrialsTool(
  rawInput: unknown,
  client: CTGovClient
): Promise<CompareTrialsOutput> {
  const parsed = compareTrialsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const uniqueIds = [...new Set(parsed.data.nctIds)];

  const results = await Promise.all(
    uniqueIds.map(async (nctId) => {
      try {
        const details = await client.getStudy(nctId);
        return { nctId, details, error: null as string | null };
      } catch (e) {
        const reason = e instanceof NotFoundError ? "not found" : "upstream error";
        return { nctId, details: null as TrialDetails | null, error: reason };
      }
    })
  );

  const trials: Record<string, TrialDetails> = {};
  const failed: Array<{ nctId: string; reason: string }> = [];
  for (const r of results) {
    if (r.details) trials[r.nctId] = r.details;
    else failed.push({ nctId: r.nctId, reason: r.error ?? "unknown" });
  }
  return { trials, failed };
}

export const COMPARE_TRIALS_DESCRIPTION = `Fetch 2-5 trials in one call for side-by-side comparison. Use this when the user has a shortlist and wants to compare them — don't call get_trial_details separately.

Returns a map keyed by NCT ID plus a failed[] list for any IDs that weren't found. Present the comparison as a table to the user, highlighting key differences: phase, status, locations count, sponsor, enrollment count, key eligibility differences. Quote eligibility criteria verbatim when they differ between trials. ALWAYS surface the lastUpdated field; data can lag reality by weeks.`;
