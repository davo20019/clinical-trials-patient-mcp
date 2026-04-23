import { describe, it, expect, vi } from "vitest";
import { compareTrialsTool } from "../../src/tools/compare-trials";
import { NotFoundError } from "../../src/errors";

function fakeDetails(nctId: string) {
  return { identification: { nctId } } as any;
}

describe("compareTrialsTool", () => {
  it("fetches multiple trials in parallel and returns them keyed by NCT ID", async () => {
    const fakeClient = {
      getStudy: vi.fn(async (id: string) => fakeDetails(id)),
    } as any;

    const result = await compareTrialsTool(
      { nctIds: ["NCT00000001", "NCT00000002", "NCT00000003"] },
      fakeClient
    );

    expect(Object.keys(result.trials)).toEqual([
      "NCT00000001",
      "NCT00000002",
      "NCT00000003",
    ]);
    expect(result.failed).toEqual([]);
    expect(fakeClient.getStudy).toHaveBeenCalledTimes(3);
  });

  it("partial failures go into failed[], rest of trials are returned", async () => {
    const fakeClient = {
      getStudy: vi.fn(async (id: string) => {
        if (id === "NCT00000002") throw new NotFoundError("No trial found");
        return fakeDetails(id);
      }),
    } as any;

    const result = await compareTrialsTool(
      { nctIds: ["NCT00000001", "NCT00000002", "NCT00000003"] },
      fakeClient
    );

    expect(Object.keys(result.trials)).toEqual(["NCT00000001", "NCT00000003"]);
    expect(result.failed).toEqual([
      { nctId: "NCT00000002", reason: "not found" },
    ]);
  });

  it("rejects fewer than 2 NCT IDs", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    await expect(
      compareTrialsTool({ nctIds: ["NCT00000001"] }, fakeClient)
    ).rejects.toThrow(/at least 2/);
    expect(fakeClient.getStudy).not.toHaveBeenCalled();
  });

  it("rejects more than 5 NCT IDs", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    await expect(
      compareTrialsTool(
        {
          nctIds: [
            "NCT00000001",
            "NCT00000002",
            "NCT00000003",
            "NCT00000004",
            "NCT00000005",
            "NCT00000006",
          ],
        },
        fakeClient
      )
    ).rejects.toThrow(/at most 5/);
  });

  it("rejects malformed NCT IDs before hitting the client", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    await expect(
      compareTrialsTool({ nctIds: ["NCT00000001", "garbage"] }, fakeClient)
    ).rejects.toThrow(/NCT/);
    expect(fakeClient.getStudy).not.toHaveBeenCalled();
  });

  it("de-duplicates repeated NCT IDs", async () => {
    const fakeClient = {
      getStudy: vi.fn(async (id: string) => fakeDetails(id)),
    } as any;

    await compareTrialsTool(
      { nctIds: ["NCT00000001", "NCT00000001", "NCT00000002"] },
      fakeClient
    );

    expect(fakeClient.getStudy).toHaveBeenCalledTimes(2);
  });
});
