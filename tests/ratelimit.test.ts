import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// Each limiter instance records its config. The test sets the result per key.
const limitResults = new Map<string, boolean>();
const limitCalls: string[] = [];
const created: { limiter: unknown; prefix?: string }[] = [];

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    private cfg: { limiter: unknown; prefix?: string };
    constructor(cfg: { limiter: unknown; prefix?: string }) {
      this.cfg = cfg;
      created.push(cfg);
    }
    static slidingWindow(n: number, w: string) {
      return { kind: "sliding", n, w };
    }
    static fixedWindow(n: number, w: string) {
      return { kind: "fixed", n, w };
    }
    async limit(key: string) {
      limitCalls.push(key);
      return { success: limitResults.get(key) ?? true };
    }
  }
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(public cfg: unknown) {}
  }
  return { Redis };
});

const MSG_HOUR = "You've reached the hourly scan limit. Please try again later.";
const MSG_DAY = "Daily scan limit reached, try again tomorrow.";
const MSG_UNCONFIGURED = "The service is not available. Try again later.";

async function load() {
  vi.resetModules();
  return import("@/lib/ratelimit");
}

describe("rate limits", () => {
  beforeEach(() => {
    limitResults.clear();
    limitCalls.length = 0;
    created.length = 0;
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows under the limit", async () => {
    const { checkScanLimit } = await load();
    expect(await checkScanLimit("1.2.3.4")).toEqual({ ok: true });
    expect(limitCalls).toEqual(["scan:ip:1.2.3.4", "scan:global"]);
  });

  it("returns the hourly message when the per-IP limiter denies", async () => {
    limitResults.set("scan:ip:1.2.3.4", false);
    const { checkScanLimit } = await load();
    expect(await checkScanLimit("1.2.3.4")).toEqual({ ok: false, message: MSG_HOUR });
  });

  it("returns the daily message when the global limiter denies", async () => {
    limitResults.set("scan:global", false);
    const { checkScanLimit } = await load();
    expect(await checkScanLimit("1.2.3.4")).toEqual({ ok: false, message: MSG_DAY });
  });

  it("uses the configured windows", async () => {
    const { checkScanLimit } = await load();
    await checkScanLimit("1.2.3.4");
    const kinds = created.map((c) => c.limiter);
    expect(kinds).toContainEqual({ kind: "sliding", n: 10, w: "1 h" });
    expect(kinds).toContainEqual({ kind: "fixed", n: 100, w: "1 d" });
  });

  it("is a no-op when Upstash env is missing and NODE_ENV !== production", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { checkScanLimit, checkPageSpeedLimit } = await load();
    expect(await checkScanLimit("1.2.3.4")).toEqual({ ok: true });
    expect(await checkPageSpeedLimit("1.2.3.4")).toEqual({ ok: true });
    expect(limitCalls).toEqual([]);
  });

  it("fails closed when env is missing in production", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    const { checkScanLimit, checkPageSpeedLimit } = await load();
    const expected = { ok: false, unconfigured: true, message: MSG_UNCONFIGURED };
    expect(await checkScanLimit("1.2.3.4")).toEqual(expected);
    expect(await checkPageSpeedLimit("1.2.3.4")).toEqual(expected);
  });

  it("uses the Vercel KV names when the Upstash names are missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "https://kv.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    vi.stubEnv("NODE_ENV", "production");
    const { checkScanLimit, getBackend } = await load();
    expect(getBackend().kind).toBe("redis");
    expect(await checkScanLimit("1.2.3.4")).toEqual({ ok: true });
    expect(limitCalls).toEqual(["scan:ip:1.2.3.4", "scan:global"]);
  });

  it("does not throw on import when env is missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(load()).resolves.toBeDefined();
  });

  it("pagespeed limiter is independent of the scan limiter", async () => {
    limitResults.set("scan:ip:1.2.3.4", false);
    const { checkPageSpeedLimit } = await load();
    expect(await checkPageSpeedLimit("1.2.3.4")).toEqual({ ok: true });
    expect(limitCalls).toEqual(["psi:ip:1.2.3.4", "psi:global"]);

    limitResults.set("psi:ip:1.2.3.4", false);
    expect(await checkPageSpeedLimit("1.2.3.4")).toEqual({ ok: false, message: MSG_HOUR });
  });
});

describe("getClientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", async () => {
    const { getClientIp } = await load();
    const req = new Request("https://x.test", {
      headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "6.6.6.6, 1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("uses the right-most x-forwarded-for entry without x-real-ip", async () => {
    const { getClientIp } = await load();
    const req = new Request("https://x.test", {
      headers: { "x-forwarded-for": "6.6.6.6, 5.5.5.5" },
    });
    expect(getClientIp(req)).toBe("5.5.5.5");
  });

  it("returns 'unknown' without either header", async () => {
    const { getClientIp } = await load();
    expect(getClientIp(new Request("https://x.test"))).toBe("unknown");
  });
});
