import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitResult = { ok: true } | { ok: false; message: string };

const MESSAGE_HOURLY = "You've reached the hourly scan limit. Please try again later.";
const MESSAGE_DAILY = "Daily scan limit reached, try again tomorrow.";
const MESSAGE_LOGIN = "Too many attempts. Please wait 15 minutes.";
export const MESSAGE_UNCONFIGURED = "Rate limiting is not configured.";

/**
 * The single place that decides how Upstash is used.
 * - "redis": the env is set. Use Upstash.
 * - "dev": the env is missing and this is not production. Skip the limits.
 * - "unconfigured": the env is missing in production. Fail closed.
 * The Redis client is created on first use, not at import.
 */
export type Backend =
  | { kind: "redis"; redis: Redis }
  | { kind: "dev" }
  | { kind: "unconfigured" };

let redisClient: Redis | undefined;

export function getBackend(): Backend {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redisClient ??= new Redis({ url, token });
    return { kind: "redis", redis: redisClient };
  }
  return process.env.NODE_ENV === "production" ? { kind: "unconfigured" } : { kind: "dev" };
}

type LimiterName = "scanIp" | "scanGlobal" | "psiIp" | "psiGlobal" | "loginIp" | "loginGlobal";

const limiters = new Map<LimiterName, Ratelimit>();

function getLimiter(name: LimiterName, redis: Redis): Ratelimit {
  let limiter = limiters.get(name);
  if (!limiter) {
    const perIpHour = () => Ratelimit.slidingWindow(10, "1 h");
    const globalDay = () => Ratelimit.fixedWindow(100, "1 d");
    const config = {
      scanIp: perIpHour,
      scanGlobal: globalDay,
      psiIp: perIpHour,
      psiGlobal: globalDay,
      loginIp: () => Ratelimit.slidingWindow(10, "15 m"),
      loginGlobal: () => Ratelimit.slidingWindow(50, "15 m"),
    }[name]();
    limiter = new Ratelimit({ redis, limiter: config, prefix: `sitelens:${name}` });
    limiters.set(name, limiter);
  }
  return limiter;
}

async function checkPair(
  ipName: LimiterName,
  ipKey: string,
  globalName: LimiterName,
  globalKey: string,
): Promise<LimitResult> {
  const backend = getBackend();
  if (backend.kind === "dev") return { ok: true };
  if (backend.kind === "unconfigured") return { ok: false, message: MESSAGE_UNCONFIGURED };

  const perIp = await getLimiter(ipName, backend.redis).limit(ipKey);
  if (!perIp.success) return { ok: false, message: MESSAGE_HOURLY };
  const global = await getLimiter(globalName, backend.redis).limit(globalKey);
  if (!global.success) return { ok: false, message: MESSAGE_DAILY };
  return { ok: true };
}

export function checkScanLimit(ip: string): Promise<LimitResult> {
  return checkPair("scanIp", `scan:ip:${ip}`, "scanGlobal", "scan:global");
}

export function checkPageSpeedLimit(ip: string): Promise<LimitResult> {
  return checkPair("psiIp", `psi:ip:${ip}`, "psiGlobal", "psi:global");
}

export async function checkLoginLimit(ip: string): Promise<LimitResult> {
  const backend = getBackend();
  if (backend.kind === "dev") return { ok: true };
  if (backend.kind === "unconfigured") return { ok: false, message: MESSAGE_UNCONFIGURED };
  const perIp = await getLimiter("loginIp", backend.redis).limit(`login:ip:${ip}`);
  if (!perIp.success) return { ok: false, message: MESSAGE_LOGIN };
  const global = await getLimiter("loginGlobal", backend.redis).limit("login:global");
  return global.success ? { ok: true } : { ok: false, message: MESSAGE_LOGIN };
}

/**
 * Returns the client IP.
 * A client can set the left entries of x-forwarded-for. Those entries are not safe.
 * Use x-real-ip first, because Vercel sets it to the real client IP.
 * Else use the right-most x-forwarded-for entry, which the nearest proxy added.
 */
export function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const entries = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  const last = entries[entries.length - 1]?.trim();
  return last || "unknown";
}
