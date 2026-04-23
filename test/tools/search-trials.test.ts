import { describe, it, expect, vi } from "vitest";
import { searchTrialsTool } from "../../src/tools/search-trials";

describe("searchTrialsTool", () => {
  it("forwards params and returns SearchResult", async () => {
    const fakeResult = {
      totalCount: 1,
      trials: [
        {
          nctId: "NCT00000001",
          title: "Example trial",
          briefSummary: "Summary",
          phase: "PHASE2",
          status: "RECRUITING",
          conditions: ["Breast Cancer"],
          locations: [],
          sponsor: "Example Sponsor",
          lastUpdated: "2025-01-01",
          officialUrl: "https://clinicaltrials.gov/study/NCT00000001",
        },
      ],
      nextPageToken: null,
    };
    const fakeClient = {
      searchStudies: vi.fn(async () => fakeResult),
    } as any;

    const result = await searchTrialsTool(
      { condition: "breast cancer", location: "Denver, CO", pageSize: 5 },
      fakeClient
    );

    expect(fakeClient.searchStudies).toHaveBeenCalledWith({
      condition: "breast cancer",
      location: "Denver, CO",
      status: "recruiting",
      phase: "any",
      pageSize: 5,
    });
    expect(result).toEqual(fakeResult);
  });

  it("forwards pageToken for pagination", async () => {
    const fakeResult = { totalCount: 100, trials: [], nextPageToken: "abc123" };
    const fakeClient = {
      searchStudies: vi.fn(async () => fakeResult),
    } as any;

    await searchTrialsTool(
      { condition: "breast cancer", pageToken: "page2tok" },
      fakeClient
    );

    expect(fakeClient.searchStudies).toHaveBeenCalledWith(
      expect.objectContaining({ pageToken: "page2tok" })
    );
  });

  it("validates inputs", async () => {
    const fakeClient = { searchStudies: vi.fn() } as any;
    await expect(
      searchTrialsTool({ condition: "" }, fakeClient)
    ).rejects.toThrow(/condition/i);
    await expect(
      searchTrialsTool({ condition: "x", phase: "bogus" as any }, fakeClient)
    ).rejects.toThrow();
  });
});
