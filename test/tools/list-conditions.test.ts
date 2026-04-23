import { describe, it, expect, vi } from "vitest";
import { listConditionsTool } from "../../src/tools/list-conditions";

describe("listConditionsTool", () => {
  it("forwards the query and returns normalized results", async () => {
    const fakeClient = {
      listConditions: vi.fn(async () => [
        { condition: "Breast Cancer", synonyms: [], studyCount: 12 },
      ]),
    } as any;

    const result = await listConditionsTool({ query: "breast cancer" }, fakeClient);

    expect(fakeClient.listConditions).toHaveBeenCalledWith("breast cancer");
    expect(result.conditions).toEqual([
      { condition: "Breast Cancer", synonyms: [], studyCount: 12 },
    ]);
  });

  it("throws on empty query", async () => {
    const fakeClient = { listConditions: vi.fn() } as any;
    await expect(listConditionsTool({ query: "" }, fakeClient)).rejects.toThrow(
      /query/i
    );
  });
});
