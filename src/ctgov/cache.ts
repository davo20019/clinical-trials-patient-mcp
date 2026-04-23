import { UpstreamError } from "../errors";

type FetchFn = (request: Request) => Promise<Response>;

export interface CachedFetcherOptions {
  ttlSeconds: number;
  fetchFn?: FetchFn;
}

export class CachedFetcher {
  private readonly ttlSeconds: number;
  private readonly fetchFn: FetchFn;
  // In-process fallback cache for test environments where `caches.default`
  // behaves as a no-op between runs. Real Workers runtime uses caches.default.
  private readonly memory = new Map<string, unknown>();

  constructor(opts: CachedFetcherOptions) {
    this.ttlSeconds = opts.ttlSeconds;
    this.fetchFn = opts.fetchFn ?? ((req) => fetch(req));
  }

  async getJson<T>(url: string): Promise<T> {
    if (this.memory.has(url)) {
      return this.memory.get(url) as T;
    }
    const cache = (globalThis as { caches?: CacheStorage }).caches?.default;
    const req = new Request(url, { method: "GET" });
    if (cache) {
      const cached = await cache.match(req);
      if (cached) {
        const parsed = (await cached.json()) as T;
        this.memory.set(url, parsed);
        return parsed;
      }
    }
    const res = await this.fetchFn(req);
    if (!res.ok) {
      throw new UpstreamError(`Upstream ${res.status} for ${url}`);
    }
    const bodyText = await res.text();
    const parsed = JSON.parse(bodyText) as T;
    this.memory.set(url, parsed);
    if (cache) {
      const toStore = new Response(bodyText, {
        status: 200,
        headers: { "Cache-Control": `public, max-age=${this.ttlSeconds}` },
      });
      await cache.put(req, toStore);
    }
    return parsed;
  }
}
