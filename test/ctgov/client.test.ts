import { describe, it, expect, vi } from "vitest";
import searchFixture from "../fixtures/search-breast-cancer.json";
import studyFixture from "../fixtures/study-NCT-example.json";
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

describe("CTGovClient.getStudy", () => {
  it("returns full TrialDetails on success", async () => {
    const { client, fetchFn } = clientWithFixture(studyFixture);
    const nctId = (studyFixture as any).protocolSection.identificationModule.nctId;

    const result = await client.getStudy(nctId);

    expect(result.identification.nctId).toBe(nctId);
    expect(result.references.officialUrl).toBe(
      `https://clinicaltrials.gov/study/${nctId}`
    );
    expect(typeof result.eligibility.criteria).toBe("string");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0].url).toContain(`/studies/${nctId}`);
  });

  it("rejects invalid NCT ID format", async () => {
    const { client } = clientWithFixture(studyFixture);
    await expect(client.getStudy("not-a-nct")).rejects.toThrow(/NCT ID/);
  });

  it("throws NotFoundError on upstream 404", async () => {
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response("not found", { status: 404 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });
    await expect(client.getStudy("NCT00000000")).rejects.toThrow(/no trial found/i);
  });
});

describe("CTGovClient.listConditions", () => {
  it("aggregates conditions from matching studies", async () => {
    const fakeResponse = {
      studies: [
        {
          protocolSection: {
            identificationModule: { nctId: "NCT00000001" },
            conditionsModule: {
              conditions: ["Breast Cancer", "Triple Negative Breast Cancer"],
            },
          },
        },
        {
          protocolSection: {
            identificationModule: { nctId: "NCT00000002" },
            conditionsModule: {
              conditions: ["Breast Cancer", "HER2-positive Breast Cancer"],
            },
          },
        },
      ],
    };
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(fakeResponse), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });

    const result = await client.listConditions("breast cancer");

    const names = result.map((c) => c.condition);
    expect(names).toContain("Breast Cancer");
    // Most frequent should come first.
    expect(result[0].condition).toBe("Breast Cancer");
    expect(result[0].studyCount).toBe(2);
    // Caps result length.
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("rejects empty query", async () => {
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify({ studies: [] }), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });
    await expect(client.listConditions("")).rejects.toThrow(/query/i);
  });
});
