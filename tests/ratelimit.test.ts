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
const MSG_LOGIN = "Too many attempts. Please wait 15 minutes.";
const MSG_UNCONFIGURED = "Rate limiting is not configured.";

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
    const { checkScanLimit, checkLoginLimit } = await load();
    await checkScanLimit("1.2.3.4");
    await checkLoginLimit("1.2.3.4");
    const kinds = created.map((c) => c.limiter);
    expect(kinds).toContainEqual({ kind: "sliding", n: 10, w: "1 h" });
    expect(kinds).toContainEqual({ kind: "fixed", n: 100, w: "1 d" });
    expect(kinds).toContainEqual({ kind: "sliding", n: 10, w: "15 m" });
  });

  it("checks login with its own key and message", async () => {
    limitResults.set("login:ip:9.9.9.9", false);
    const { checkLoginLimit } = await load();
    expect(await checkLoginLimit("9.9.9.9")).toEqual({ ok: false, message: MSG_LOGIN });
  });

  it("is a no-op when Upstash env is missing and NODE_ENV !== production", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { checkScanLimit, checkPageSpeedLimit, checkLoginLimit } = await load();
    expect(await checkScanLimit("1.2.3.4")).toEqual({ ok: true });
    expect(await checkPageSpeedLimit("1.2.3.4")).toEqual({ ok: true });
    expect(await checkLoginLimit("1.2.3.4")).toEqual({ ok: true });
    expect(limitCalls).toEqual([]);
  });

  it("fails closed when env is missing in production", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    const { checkScanLimit, checkPageSpeedLimit, checkLoginLimit } = await load();
    const expected = { ok: false, message: MSG_UNCONFIGURED };
    expect(await checkScanLimit("1.2.3.4")).toEqual(expected);
    expect(await checkPageSpeedLimit("1.2.3.4")).toEqual(expected);
    expect(await checkLoginLimit("1.2.3.4")).toEqual(expected);
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
  it("returns the first x-forwarded-for entry", async () => {
    const { getClientIp } = await load();
    const req = new Request("https://x.test", {
      headers: { "x-forwarded-for": " 5.6.7.8 , 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("returns 'unknown' without the header", async () => {
    const { getClientIp } = await load();
    expect(getClientIp(new Request("https://x.test"))).toBe("unknown");
  });
});
