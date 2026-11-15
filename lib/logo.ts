// The logo must be a real PNG or JPEG. The file name and the browser MIME type are not enough,
// because the browser takes the MIME type from the file extension.

export type LogoKind = 'png' | 'jpeg';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);
}

/** The image kind from the first bytes of a file, or null when it is not a PNG or a JPEG. */
export function imageKind(bytes: Uint8Array): LogoKind | null {
  if (startsWith(bytes, PNG)) return 'png';
  if (startsWith(bytes, JPEG)) return 'jpeg';
  return null;
}

const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

/** True when the value is a PNG or JPEG data URL and its first bytes match the stated type. */
export function isValidLogoDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATA_URL.exec(value);
  if (!match) return false;
  try {
    // 12 base64 characters decode to the first 9 bytes, enough for both signatures.
    const head = atob(match[2].slice(0, 12));
    return imageKind(Uint8Array.from(head, (c) => c.charCodeAt(0))) === match[1];
  } catch {
    return false;
  }
}
