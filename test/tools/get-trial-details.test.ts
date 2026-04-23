import { describe, it, expect, vi } from "vitest";
import { getTrialDetailsTool } from "../../src/tools/get-trial-details";

describe("getTrialDetailsTool", () => {
  it("forwards NCT ID and returns the details unchanged", async () => {
    const fakeDetails = { identification: { nctId: "NCT00000001" } } as any;
    const fakeClient = {
      getStudy: vi.fn(async () => fakeDetails),
    } as any;

    const result = await getTrialDetailsTool(
      { nctId: "NCT00000001" },
      fakeClient
    );

    expect(fakeClient.getStudy).toHaveBeenCalledWith("NCT00000001");
    expect(result).toBe(fakeDetails);
  });

  it("rejects malformed NCT IDs before hitting the client", async () => {
    const fakeClient = { getStudy: vi.fn() } as any;
    await expect(
      getTrialDetailsTool({ nctId: "foo" }, fakeClient)
    ).rejects.toThrow(/NCT/i);
    expect(fakeClient.getStudy).not.toHaveBeenCalled();
  });
});
