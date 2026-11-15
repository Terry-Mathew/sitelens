import { getBackend, MESSAGE_UNCONFIGURED } from "@/lib/ratelimit";

const TICKET_TTL_MS = 10 * 60 * 1000;
const MARK_TTL_SECONDS = 900;
const MESSAGE_USED = "This performance check has already been run.";
const MESSAGE_INVALID = "This performance ticket is not valid.";
const MESSAGE_EXPIRED = "This performance ticket has expired.";
const MESSAGE_WRONG_URL = "This performance ticket is for a different website.";

type Payload = { scanId: string; url: string; exp: number };
type RedeemResult = { ok: true } | { ok: false; error: string };

// Dev only. Used when Upstash is not configured and NODE_ENV is not production.
const devUsed = new Set<string>();

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(text, "base64url"));
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issuePerformanceTicket(
  scanId: string,
  url: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const payload: Payload = { scanId, url, exp: nowMs + TICKET_TTL_MS };
  const body = encoder.encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await getKey(), body);
  return `${toBase64Url(body)}.${toBase64Url(new Uint8Array(signature))}`;
}

function parsePayload(bytes: Uint8Array): Payload | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Payload>;
    if (
      typeof value.scanId === "string" &&
      typeof value.url === "string" &&
      typeof value.exp === "number"
    ) {
      return { scanId: value.scanId, url: value.url, exp: value.exp };
    }
  } catch {
    // Fall through. A bad payload is an invalid ticket.
  }
  return null;
}

export async function redeemPerformanceTicket(
  ticket: string,
  url: string,
  nowMs: number = Date.now(),
): Promise<RedeemResult> {
  const invalid: RedeemResult = { ok: false, error: MESSAGE_INVALID };
  const parts = ticket.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalid;

  const body = fromBase64Url(parts[0]);
  const signature = fromBase64Url(parts[1]);
  // crypto.subtle.verify compares the signature in constant time.
  const valid = await crypto.subtle.verify("HMAC", await getKey(), signature, body);
  if (!valid) return invalid;

  const payload = parsePayload(body);
  if (!payload) return invalid;
  if (nowMs > payload.exp) return { ok: false, error: MESSAGE_EXPIRED };
  if (payload.url !== url) return { ok: false, error: MESSAGE_WRONG_URL };

  const backend = getBackend();
  if (backend.kind === "unconfigured") return { ok: false, error: MESSAGE_UNCONFIGURED };

  const markKey = `psi:ticket:${payload.scanId}`;
  if (backend.kind === "dev") {
    if (devUsed.has(markKey)) return { ok: false, error: MESSAGE_USED };
    devUsed.add(markKey);
    return { ok: true };
  }

  // SET NX returns null when the key exists. The ticket is then already used.
  const marked = await backend.redis.set(markKey, 1, { nx: true, ex: MARK_TTL_SECONDS });
  return marked ? { ok: true } : { ok: false, error: MESSAGE_USED };
}
