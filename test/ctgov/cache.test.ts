import { describe, it, expect, vi } from "vitest";
import { CachedFetcher } from "../../src/ctgov/cache";

describe("CachedFetcher", () => {
  it("returns fetched body on a miss", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const cache = new CachedFetcher({ ttlSeconds: 300, fetchFn });

    const result = await cache.getJson<{ ok: boolean }>(
      "https://example.test/a"
    );

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("serves subsequent identical requests from cache", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const cache = new CachedFetcher({ ttlSeconds: 300, fetchFn });

    await cache.getJson("https://example.test/b");
    await cache.getJson("https://example.test/b");

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws on non-2xx responses", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 500 }));
    const cache = new CachedFetcher({ ttlSeconds: 300, fetchFn });

    await expect(cache.getJson("https://example.test/c")).rejects.toThrow();
  });
});
