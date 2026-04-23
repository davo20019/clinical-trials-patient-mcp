import { z } from "zod";
import { InvalidInputError } from "../errors";
import type { CTGovClient } from "../ctgov/client";
import type { ConditionMatch } from "../ctgov/types";

export const listConditionsInputSchema = z.object({
  query: z.string().min(1, "query is required"),
});

export type ListConditionsInput = z.infer<typeof listConditionsInputSchema>;

export interface ListConditionsOutput {
  conditions: ConditionMatch[];
}

export async function listConditionsTool(
  rawInput: unknown,
  client: CTGovClient
): Promise<ListConditionsOutput> {
  const parsed = listConditionsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new InvalidInputError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const conditions = await client.listConditions(parsed.data.query);
  return { conditions };
}

export const LIST_CONDITIONS_DESCRIPTION = `Look up candidate condition names on ClinicalTrials.gov for a patient's vague term (e.g. "breast cancer" -> "Triple Negative Breast Cancer", "HER2-positive Breast Cancer"). Use this FIRST when the user's condition could map to multiple subtypes. Show the returned conditions to the user and ask them which one to search.`;
