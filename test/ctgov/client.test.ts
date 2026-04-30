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

  it("passes pageToken to upstream and surfaces nextPageToken in result", async () => {
    const upstream = {
      totalCount: 150,
      studies: [],
      nextPageToken: "server-returned-token",
    };
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(upstream), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });

    const result = await client.searchStudies({
      condition: "x",
      pageToken: "incoming-token",
    });

    expect(fetchFn.mock.calls[0][0].url).toContain("pageToken=incoming-token");
    expect(result.nextPageToken).toBe("server-returned-token");
  });

  it("returns nextPageToken: null when upstream omits it", async () => {
    const upstream = { totalCount: 3, studies: [] };
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(upstream), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });

    const result = await client.searchStudies({ condition: "x" });
    expect(result.nextPageToken).toBeNull();
  });

  it("uses CT.gov geo filtering for ZIP radius searches and sorts by nearest site", async () => {
    const upstream = {
      totalCount: 2,
      studies: [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT00000002",
              briefTitle: "Boulder trial",
            },
            statusModule: {
              overallStatus: "RECRUITING",
              lastUpdatePostDateStruct: { date: "2026-01-01" },
            },
            contactsLocationsModule: {
              locations: [
                {
                  facility: "Boulder Site",
                  city: "Boulder",
                  state: "Colorado",
                  country: "United States",
                  geoPoint: { lat: 40.015, lon: -105.2705 },
                },
              ],
            },
          },
        },
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT00000001",
              briefTitle: "Denver trial",
            },
            statusModule: {
              overallStatus: "RECRUITING",
              lastUpdatePostDateStruct: { date: "2026-01-01" },
            },
            contactsLocationsModule: {
              locations: [
                {
                  facility: "Denver Site",
                  city: "Denver",
                  state: "Colorado",
                  country: "United States",
                  geoPoint: { lat: 39.7516, lon: -104.9977 },
                },
              ],
            },
          },
        },
      ],
    };
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(upstream), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });

    const result = await client.searchStudies({
      condition: "breast cancer",
      location: "80202",
      radiusMiles: 50,
    });

    const calledUrl = decodeURIComponent(fetchFn.mock.calls[0][0].url);
    expect(calledUrl).toContain(
      "filter.geo=distance(39.7515,-104.9977,50mi)"
    );
    expect(calledUrl).not.toContain("query.locn=");
    expect(result.trials.map((trial) => trial.nctId)).toEqual([
      "NCT00000001",
      "NCT00000002",
    ]);
    expect(result.trials[0].nearestSiteMiles).toBeLessThan(0.1);
    expect(result.trials[1].nearestSiteMiles).toBeGreaterThan(20);
  });

  it("uses caller-provided coordinates for radius searches", async () => {
    const upstream = { totalCount: 0, studies: [] };
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(upstream), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });

    await client.searchStudies({
      condition: "breast cancer",
      latitude: 39.7392,
      longitude: -104.9903,
      radiusMiles: 25,
    });

    const calledUrl = decodeURIComponent(fetchFn.mock.calls[0][0].url);
    expect(calledUrl).toContain(
      "filter.geo=distance(39.7392,-104.9903,25mi)"
    );
  });

  it("rejects non-ZIP locations when radiusMiles is set", async () => {
    const fetchFn = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify({ studies: [] }), { status: 200 })
    );
    const fetcher = new CachedFetcher({ ttlSeconds: 0, fetchFn });
    const client = new CTGovClient({ fetcher });

    await expect(
      client.searchStudies({
        condition: "breast cancer",
        location: "Denver, CO",
        radiusMiles: 50,
      })
    ).rejects.toThrow(/ZIP code/i);
    expect(fetchFn).not.toHaveBeenCalled();
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
