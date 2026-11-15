import { describe, expect, it } from 'vitest';
import { imageKind, isValidLogoDataUrl } from '@/lib/logo';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('imageKind', () => {
  it('reads the PNG and JPEG signatures', () => {
    expect(imageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png');
    expect(imageKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
  });
  it('rejects other bytes', () => {
    expect(imageKind(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(imageKind(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(imageKind(bytes())).toBeNull();
  });
});

describe('isValidLogoDataUrl', () => {
  it('needs a PNG or JPEG prefix that matches the decoded bytes', () => {
    expect(isValidLogoDataUrl(`data:image/png;base64,${btoa('\x89PNG\r\n\x1a\nxx')}`)).toBe(true);
    expect(isValidLogoDataUrl(`data:image/jpeg;base64,${btoa('\xff\xd8\xffxx')}`)).toBe(true);
    expect(isValidLogoDataUrl(`data:image/png;base64,${btoa('\xff\xd8\xffxx')}`)).toBe(false);
    expect(isValidLogoDataUrl(`data:image/gif;base64,${btoa('GIF89a')}`)).toBe(false);
    expect(isValidLogoDataUrl('data:image/png;base64,***')).toBe(false);
    expect(isValidLogoDataUrl(42)).toBe(false);
  });
});
