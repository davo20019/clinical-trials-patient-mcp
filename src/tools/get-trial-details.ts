import { z } from "zod";
import { InvalidInputError } from "../errors";
import type { CTGovClient } from "../ctgov/client";
import type { TrialDetails } from "../ctgov/types";

export const getTrialDetailsInputSchema = z.object({
  nctId: z
    .string()
    .regex(/^NCT\d{8}$/, "nctId must look like NCT followed by 8 digits"),
});

export type GetTrialDetailsInput = z.infer<typeof getTrialDetailsInputSchema>;

export async function getTrialDetailsTool(
  rawInput: unknown,
  client: CTGovClient
): Promise<TrialDetails> {
  const parsed = getTrialDetailsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return client.getStudy(parsed.data.nctId);
}

export const GET_TRIAL_DETAILS_DESCRIPTION = `Fetch the full details for one trial by its NCT ID (e.g. "NCT01234567"). Returns identification, summary, status, eligibility criteria, per-site locations and contacts (phone/email where available), interventions, and references. When presenting eligibility to the user, QUOTE the criteria verbatim rather than summarizing — only a trial coordinator can confirm whether someone qualifies. Always mention the lastUpdated field and recommend calling the trial site to confirm current enrollment. Include the officialUrl so the user can view the source.`;
