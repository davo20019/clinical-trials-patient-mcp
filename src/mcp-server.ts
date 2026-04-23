import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CachedFetcher } from "./ctgov/cache";
import { CTGovClient } from "./ctgov/client";
import {
  listConditionsTool,
  listConditionsInputSchema,
  LIST_CONDITIONS_DESCRIPTION,
} from "./tools/list-conditions";
import {
  searchTrialsTool,
  searchTrialsInputSchema,
  SEARCH_TRIALS_DESCRIPTION,
} from "./tools/search-trials";
import {
  getTrialDetailsTool,
  getTrialDetailsInputSchema,
  GET_TRIAL_DETAILS_DESCRIPTION,
} from "./tools/get-trial-details";
import {
  compareTrialsTool,
  compareTrialsInputSchema,
  COMPARE_TRIALS_DESCRIPTION,
} from "./tools/compare-trials";
import {
  parseEligibilityCriteriaTool,
  parseEligibilityInputSchema,
  PARSE_ELIGIBILITY_DESCRIPTION,
} from "./tools/parse-eligibility-criteria";
import { isKnownError } from "./errors";

const GLOBAL_DISCLAIMER = `This server provides information from ClinicalTrials.gov to help patients and caregivers discover clinical trials. It is NOT medical advice. Data may lag reality by weeks — always confirm current enrollment by calling the trial site and discuss any trial with the patient's treating physician before acting.`;

function toolResponse(result: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(result) },
    ],
  };
}

function errorResponse(e: unknown) {
  const message = isKnownError(e) ? e.message : "Unexpected error.";
  return {
    isError: true,
    content: [
      { type: "text" as const, text: message },
    ],
  };
}

export class ClinicalTrialsPatientMcp extends McpAgent {
  server = new McpServer({
    name: "clinical-trials-patient-mcp",
    version: "0.1.0",
  });

  async init() {
    const fetcher = new CachedFetcher({ ttlSeconds: 300 });
    const client = new CTGovClient({ fetcher });

    this.server.registerTool(
      "list_conditions",
      {
        description: `${LIST_CONDITIONS_DESCRIPTION}\n\n${GLOBAL_DISCLAIMER}`,
        inputSchema: listConditionsInputSchema.shape,
      },
      async (input) => {
        try {
          const result = await listConditionsTool(input, client);
          return toolResponse(result);
        } catch (e) {
          return errorResponse(e);
        }
      }
    );

    this.server.registerTool(
      "search_trials",
      {
        description: `${SEARCH_TRIALS_DESCRIPTION}\n\n${GLOBAL_DISCLAIMER}`,
        inputSchema: searchTrialsInputSchema.shape,
      },
      async (input) => {
        try {
          const result = await searchTrialsTool(input, client);
          return toolResponse(result);
        } catch (e) {
          return errorResponse(e);
        }
      }
    );

    this.server.registerTool(
      "get_trial_details",
      {
        description: `${GET_TRIAL_DETAILS_DESCRIPTION}\n\n${GLOBAL_DISCLAIMER}`,
        inputSchema: getTrialDetailsInputSchema.shape,
      },
      async (input) => {
        try {
          const result = await getTrialDetailsTool(input, client);
          return toolResponse(result);
        } catch (e) {
          return errorResponse(e);
        }
      }
    );

    this.server.registerTool(
      "compare_trials",
      {
        description: `${COMPARE_TRIALS_DESCRIPTION}\n\n${GLOBAL_DISCLAIMER}`,
        inputSchema: compareTrialsInputSchema.shape,
      },
      async (input) => {
        try {
          const result = await compareTrialsTool(input, client);
          return toolResponse(result);
        } catch (e) {
          return errorResponse(e);
        }
      }
    );

    this.server.registerTool(
      "parse_eligibility_criteria",
      {
        description: `${PARSE_ELIGIBILITY_DESCRIPTION}\n\n${GLOBAL_DISCLAIMER}`,
        inputSchema: parseEligibilityInputSchema.shape,
      },
      async (input) => {
        try {
          const result = await parseEligibilityCriteriaTool(input, client);
          return toolResponse(result);
        } catch (e) {
          return errorResponse(e);
        }
      }
    );
  }
}
