import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const setCalls: { key: string; value: unknown; opts: unknown }[] = [];
const used = new Set<string>();

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow() {
      return {};
    }
    static fixedWindow() {
      return {};
    }
    async limit() {
      return { success: true };
    }
  }
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => {
  class Redis {
    async set(key: string, value: unknown, opts: unknown) {
      setCalls.push({ key, value, opts });
      if (used.has(key)) return null;
      used.add(key);
      return "OK";
    }
  }
  return { Redis };
});

const NOW = 1_800_000_000_000;
const URL_A = "https://example.com/";

async function load() {
  vi.resetModules();
  return import("@/lib/tickets");
}

describe("performance tickets (Upstash)", () => {
  beforeEach(() => {
    setCalls.length = 0;
    used.clear();
    vi.stubEnv("SESSION_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redeems a fresh ticket once; second redeem fails", async () => {
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-1", URL_A, NOW);
    expect(await redeemPerformanceTicket(ticket, URL_A, NOW + 1000)).toEqual({ ok: true });
    expect(setCalls[0]).toEqual({
      key: "psi:ticket:scan-1",
      value: 1,
      opts: { nx: true, ex: 900 },
    });
    expect(await redeemPerformanceTicket(ticket, URL_A, NOW + 2000)).toEqual({
      ok: false,
      error: "This performance check has already been run.",
    });
  });

  it("rejects a ticket for a different URL", async () => {
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-2", URL_A, NOW);
    const result = await redeemPerformanceTicket(ticket, "https://other.com/", NOW + 1000);
    expect(result.ok).toBe(false);
    expect(setCalls).toHaveLength(0);
  });

  it("accepts a ticket at exactly 10 minutes and rejects at 10 min + 1 ms", async () => {
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const t1 = await issuePerformanceTicket("scan-3", URL_A, NOW);
    expect(await redeemPerformanceTicket(t1, URL_A, NOW + 600_000)).toEqual({ ok: true });
    const t2 = await issuePerformanceTicket("scan-4", URL_A, NOW);
    const late = await redeemPerformanceTicket(t2, URL_A, NOW + 600_001);
    expect(late.ok).toBe(false);
    expect(setCalls.map((c) => c.key)).toEqual(["psi:ticket:scan-3"]);
  });

  it("rejects a tampered payload", async () => {
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-5", URL_A, NOW);
    const [, sig] = ticket.split(".");
    const forged = Buffer.from(
      JSON.stringify({ scanId: "scan-5", url: URL_A, exp: NOW + 99_999_999 }),
    ).toString("base64url");
    const result = await redeemPerformanceTicket(`${forged}.${sig}`, URL_A, NOW + 1000);
    expect(result.ok).toBe(false);
  });

  it("rejects a tampered signature and malformed tickets", async () => {
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-6", URL_A, NOW);
    const [payload] = ticket.split(".");
    const badSig = Buffer.from("not-the-signature").toString("base64url");
    expect((await redeemPerformanceTicket(`${payload}.${badSig}`, URL_A, NOW)).ok).toBe(false);
    expect((await redeemPerformanceTicket("garbage", URL_A, NOW)).ok).toBe(false);
    expect((await redeemPerformanceTicket("", URL_A, NOW)).ok).toBe(false);
    expect((await redeemPerformanceTicket("a.b.c", URL_A, NOW)).ok).toBe(false);
  });

  it("verifies a fresh ticket without using it", async () => {
    const { issuePerformanceTicket, verifyPerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-v1", URL_A, NOW);
    expect(await verifyPerformanceTicket(ticket, URL_A, NOW + 1000)).toEqual({ ok: true });
    expect(await verifyPerformanceTicket(ticket, URL_A, NOW + 2000)).toEqual({ ok: true });
    expect(setCalls).toHaveLength(0);
    // The ticket is still unused, so the redeem works once.
    expect(await redeemPerformanceTicket(ticket, URL_A, NOW + 3000)).toEqual({ ok: true });
  });

  it("verify rejects an expired, mismatched, tampered or malformed ticket without a Redis call", async () => {
    const { issuePerformanceTicket, verifyPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-v2", URL_A, NOW);
    expect(await verifyPerformanceTicket(ticket, URL_A, NOW + 600_001)).toEqual({
      ok: false,
      error: "This performance ticket has expired.",
    });
    expect(await verifyPerformanceTicket(ticket, "https://other.com/", NOW)).toEqual({
      ok: false,
      error: "This performance ticket is for a different website.",
    });
    const [payload] = ticket.split(".");
    const badSig = Buffer.from("not-the-signature").toString("base64url");
    expect((await verifyPerformanceTicket(`${payload}.${badSig}`, URL_A, NOW)).ok).toBe(false);
    expect((await verifyPerformanceTicket("garbage", URL_A, NOW)).ok).toBe(false);
    expect(setCalls).toHaveLength(0);
  });

  it("rejects a ticket signed with a different secret", async () => {
    const { issuePerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-7", URL_A, NOW);
    vi.stubEnv("SESSION_SECRET", "another-secret-another-secret-another");
    const { redeemPerformanceTicket } = await load();
    expect((await redeemPerformanceTicket(ticket, URL_A, NOW + 1000)).ok).toBe(false);
  });
});

describe("performance tickets (no Upstash)", () => {
  beforeEach(() => {
    setCalls.length = 0;
    vi.stubEnv("SESSION_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses in-memory single-use tracking outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-8", URL_A, NOW);
    expect(await redeemPerformanceTicket(ticket, URL_A, NOW + 1)).toEqual({ ok: true });
    expect(await redeemPerformanceTicket(ticket, URL_A, NOW + 2)).toEqual({
      ok: false,
      error: "This performance check has already been run.",
    });
  });

  it("fails closed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { issuePerformanceTicket, redeemPerformanceTicket } = await load();
    const ticket = await issuePerformanceTicket("scan-9", URL_A, NOW);
    expect(await redeemPerformanceTicket(ticket, URL_A, NOW + 1)).toEqual({
      ok: false,
      error: "Rate limiting is not configured.",
    });
  });
});
