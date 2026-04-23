import { describe, it, expect, vi } from "vitest";
import {
  parseEligibilityCriteriaTool,
  splitInclusionExclusion,
  parseAgeToYears,
} from "../../src/tools/parse-eligibility-criteria";

describe("splitInclusionExclusion", () => {
  it("splits a standard Inclusion / Exclusion block", () => {
    const text = `Inclusion Criteria:

* Must be 18 or older.
* Confirmed diagnosis of breast cancer.

Exclusion Criteria:

* Pregnant.
* Prior chemotherapy within 6 months.`;
    const result = splitInclusionExclusion(text);
    expect(result.inclusion).toEqual([
      "Must be 18 or older.",
      "Confirmed diagnosis of breast cancer.",
    ]);
    expect(result.exclusion).toEqual([
      "Pregnant.",
      "Prior chemotherapy within 6 months.",
    ]);
    expect(result.unstructured).toBe("");
  });

  it("handles numbered bullets and hyphens", () => {
    const text = `Inclusion Criteria:
1. Age >= 18.
2. ECOG 0-1.
Exclusion Criteria:
- Active infection.
- HIV positive.`;
    const result = splitInclusionExclusion(text);
    expect(result.inclusion).toEqual(["Age >= 18.", "ECOG 0-1."]);
    expect(result.exclusion).toEqual(["Active infection.", "HIV positive."]);
  });

  it("falls through to unstructured when no recognizable sections", () => {
    const text = "Eligibility: patient must be healthy and willing.";
    const result = splitInclusionExclusion(text);
    expect(result.inclusion).toEqual([]);
    expect(result.exclusion).toEqual([]);
    expect(result.unstructured).toContain("patient must be healthy");
  });

  it("handles inclusion only (no exclusion section)", () => {
    const text = `Inclusion Criteria:
* Must be over 21.
* Driver's license required.`;
    const result = splitInclusionExclusion(text);
    expect(result.inclusion.length).toBe(2);
    expect(result.exclusion).toEqual([]);
  });

  it("handles long preamble before inclusion section", () => {
    const text = `General eligibility overview. See full protocol.

Inclusion Criteria:
* Item one.
* Item two.`;
    const result = splitInclusionExclusion(text);
    expect(result.inclusion).toEqual(["Item one.", "Item two."]);
    expect(result.unstructured).toContain("General eligibility overview");
  });
});

describe("parseAgeToYears", () => {
  it("parses 'N Years' forms", () => {
    expect(parseAgeToYears("18 Years")).toBe(18);
    expect(parseAgeToYears("65 years")).toBe(65);
  });

  it("parses months / weeks / days into fractional years", () => {
    expect(parseAgeToYears("6 Months")).toBe(0.5);
    expect(parseAgeToYears("52 Weeks")).toBe(1);
    expect(parseAgeToYears("30 Days")).toBeCloseTo(0.08, 1);
  });

  it("returns null on unparseable or empty", () => {
    expect(parseAgeToYears(null)).toBeNull();
    expect(parseAgeToYears("")).toBeNull();
    expect(parseAgeToYears("N/A")).toBeNull();
  });
});

describe("parseEligibilityCriteriaTool", () => {
  it("parses from criteriaText without hitting the client", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    const result = await parseEligibilityCriteriaTool(
      {
        criteriaText:
          "Inclusion Criteria:\n* Age 18+.\nExclusion Criteria:\n* Active infection.",
      },
      fakeClient
    );
    expect(result.inclusion).toEqual(["Age 18+."]);
    expect(result.exclusion).toEqual(["Active infection."]);
    expect(result.source.nctId).toBeNull();
    expect(fakeClient.getStudy).not.toHaveBeenCalled();
  });

  it("parses by nctId, fetching from the client", async () => {
    const fakeClient = {
      getStudy: vi.fn(async () => ({
        identification: { nctId: "NCT12345678" },
        eligibility: {
          minimumAge: "18 Years",
          maximumAge: "65 Years",
          sex: "FEMALE",
          healthyVolunteers: false,
          criteria:
            "Inclusion Criteria:\n* Age 18-65.\nExclusion Criteria:\n* Pregnant.",
        },
        status: { lastUpdated: "2026-01-01" },
      })),
    } as any;

    const result = await parseEligibilityCriteriaTool(
      { nctId: "NCT12345678" },
      fakeClient
    );

    expect(fakeClient.getStudy).toHaveBeenCalledWith("NCT12345678");
    expect(result.inclusion).toEqual(["Age 18-65."]);
    expect(result.exclusion).toEqual(["Pregnant."]);
    expect(result.ageMinYears).toBe(18);
    expect(result.ageMaxYears).toBe(65);
    expect(result.sex).toBe("FEMALE");
    expect(result.healthyVolunteers).toBe(false);
    expect(result.source).toEqual({
      nctId: "NCT12345678",
      lastUpdated: "2026-01-01",
    });
  });

  it("rejects when neither nctId nor criteriaText is provided", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    await expect(
      parseEligibilityCriteriaTool({}, fakeClient)
    ).rejects.toThrow(/nctId or criteriaText/);
  });

  it("rejects malformed nctId", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    await expect(
      parseEligibilityCriteriaTool({ nctId: "garbage" }, fakeClient)
    ).rejects.toThrow();
    expect(fakeClient.getStudy).not.toHaveBeenCalled();
  });

  it("does NOT accept a patient profile field (privacy-preserving design)", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    // Even if the caller tries to pass patient info, the schema rejects it silently
    // (extra keys are ignored by default Zod objects) — confirming there's no way
    // to persist patient data via this tool.
    const result = await parseEligibilityCriteriaTool(
      {
        criteriaText: "Inclusion Criteria:\n* Age 18+.",
        patientProfile: { age: 42, sex: "F" },
      },
      fakeClient
    );
    expect(result).toHaveProperty("inclusion");
    // The output shape never echoes back any patient data — it can't, because
    // the schema doesn't include one.
    expect(JSON.stringify(result)).not.toContain("patientProfile");
    expect(JSON.stringify(result)).not.toContain("42");
  });
});
