/**
 * Shared-code session helpers (spec 8.2).
 * This file uses only Web Crypto, so the proxy and the Node routes can both use it.
 *
 * Token format: `<expiryMs>.<base64url HMAC-SHA256 signature>`.
 * The signed text contains the expiry and the ACCESS_CODE.
 * Thus a change to SESSION_SECRET or to ACCESS_CODE makes all old tokens not valid.
 */

export const SESSION_COOKIE = 'sitelens_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

const NOT_SIGNED_IN = 'Not signed in.';
const TOKEN_PATTERN = /^(\d{1,16})\.([A-Za-z0-9_-]+)$/;
const encoder = new TextEncoder();

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function signedText(expiryMs: number, accessCode: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${expiryMs}\n${accessCode}`);
}

/** Makes a token that stays valid for 30 days. It throws when the env is not set. */
export async function signSession(nowMs: number = Date.now()): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  const code = process.env.ACCESS_CODE;
  if (!secret || !code) throw new Error('Access is not configured.');
  const expiry = nowMs + SESSION_MAX_AGE_MS;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), signedText(expiry, code));
  return `${expiry}.${toBase64Url(sig)}`;
}

/** Returns true only for a correctly signed token that has not expired. It fails closed. */
export async function verifySession(token: string | undefined, nowMs: number = Date.now()): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  const code = process.env.ACCESS_CODE;
  if (!secret || !code || !token) return false;

  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;
  const expiry = Number(match[1]);
  if (nowMs > expiry) return false;

  const sig = fromBase64Url(match[2]);
  if (!sig) return false;
  // crypto.subtle.verify compares the signature in constant time.
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, signedText(expiry, code));
}

/**
 * Compares a submitted code with ACCESS_CODE in constant time.
 * It signs the expected code and then verifies that MAC against the submitted code.
 */
export async function isAccessCode(submitted: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  const code = process.env.ACCESS_CODE;
  if (!secret || !code) return false;
  const key = await hmacKey(secret);
  const expectedMac = await crypto.subtle.sign('HMAC', key, encoder.encode(code));
  return crypto.subtle.verify('HMAC', key, expectedMac, encoder.encode(submitted));
}

/** Reads one cookie value from a Cookie header. */
export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * Each route handler must call this first.
 * It returns a 401 JSON response when the session is not valid, else null.
 */
export async function requireSession(req: Request): Promise<Response | null> {
  const token = readCookie(req.headers.get('cookie'), SESSION_COOKIE);
  if (await verifySession(token)) return null;
  return notSignedInResponse();
}

/** The 401 JSON response for a request without a valid session. */
export function notSignedInResponse(): Response {
  return Response.json({ error: NOT_SIGNED_IN }, { status: 401 });
}

function cookieAttributes(maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

/** Set-Cookie value for a new session. */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; ${cookieAttributes(SESSION_MAX_AGE_SECONDS)}`;
}

/** Set-Cookie value that removes the session. */
export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;
}
