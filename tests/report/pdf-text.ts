import { inflateSync } from 'node:zlib';
import type { ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';

// Test helper. It renders a react-pdf document to real PDF bytes and reads the text back.
// react-pdf writes the standard Helvetica fonts as WinAnsi hex strings inside TJ operators,
// in Flate-compressed content streams. This helper inflates each stream and decodes each TJ.
const decoder = new TextDecoder('windows-1252');

export interface RenderedPdf {
  raw: string;
  text: string;
}

export async function renderPdf(element: ReactElement<DocumentProps>): Promise<RenderedPdf> {
  const raw = (await renderToBuffer(element)).toString('latin1');
  const lines: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      continue; // Not a compressed content stream, for example an image.
    }
    for (const tj of content.matchAll(/\[((?:<[0-9a-fA-F]*>|[-\d.\s])*)\]\s*TJ/g)) {
      const hex = [...tj[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join('');
      lines.push(decoder.decode(Buffer.from(hex, 'hex')));
    }
  }
  // Each TJ is one line of text. A line that ends with a hyphen continues the word on the next line.
  const text = lines.reduce((acc, line) => (acc.endsWith('-') ? acc + line : `${acc} ${line}`), '');
  return { raw, text: normalise(text) };
}

export function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
