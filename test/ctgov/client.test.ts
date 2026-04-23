import { describe, it, expect, vi } from "vitest";
import searchFixture from "../fixtures/search-breast-cancer.json";
import { CTGovClient } from "../../src/ctgov/client";
import { CachedFetcher } from "../../src/ctgov/cache";

function clientWithFixture(fixture: unknown) {
  const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
    async () => new Response(JSON.stringify(fixture), { status: 200 })
  );
  const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
  return { client: new CTGovClient({ fetcher }), fetchFn };
}

describe("CTGovClient.searchStudies", () => {
  it("maps upstream studies to TrialSummary[]", async () => {
    const { client, fetchFn } = clientWithFixture(searchFixture);

    const result = await client.searchStudies({ condition: "breast cancer" });

    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.trials.length).toBeGreaterThan(0);
    const first = result.trials[0];
    expect(first.nctId).toMatch(/^NCT\d{8}$/);
    expect(first.officialUrl).toContain(first.nctId);
    expect(Array.isArray(first.locations)).toBe(true);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const calledUrl = fetchFn.mock.calls[0][0].url;
    expect(calledUrl).toContain("query.cond=breast+cancer");
    expect(calledUrl).toContain("filter.overallStatus=RECRUITING");
  });

  it("rejects empty condition", async () => {
    const { client } = clientWithFixture(searchFixture);
    await expect(client.searchStudies({ condition: "" })).rejects.toThrow(
      /condition/i
    );
  });

  it("clamps pageSize to the 25 max", async () => {
    const { client, fetchFn } = clientWithFixture(searchFixture);
    await client.searchStudies({ condition: "x", pageSize: 999 });
    expect(fetchFn.mock.calls[0][0].url).toContain("pageSize=25");
  });

  it("maps phase '1' to PHASE1|EARLY_PHASE1|PHASE1/PHASE2", async () => {
    const { client, fetchFn } = clientWithFixture(searchFixture);
    await client.searchStudies({ condition: "x", phase: "1" });
    const url = fetchFn.mock.calls[0][0].url;
    expect(url).toContain("filter.phase=");
    expect(decodeURIComponent(url)).toContain("PHASE1");
    expect(decodeURIComponent(url)).toContain("EARLY_PHASE1");
  });
});
