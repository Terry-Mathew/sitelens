import { runChecks } from '@/lib/checks/run';
import { gather } from '@/lib/gather';
import { checkScanLimit, getClientIp, type LimitResult } from '@/lib/ratelimit';
import { requireSession } from '@/lib/security/session';
import { normaliseAndValidateUrl } from '@/lib/security/url';
import { issuePerformanceTicket } from '@/lib/tickets';
import type { ScanResponse, ScanResult } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_URL_LENGTH = 2048;
const BAD_URL = 'Enter a valid website address.';
const NOT_AVAILABLE = 'The service is not available. Try again later.';
const SCAN_FAILED = 'Scan failed. Please try again.';

async function readUrl(req: Request): Promise<string | null> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object' && 'url' in body && typeof body.url === 'string') {
      return body.url.length <= MAX_URL_LENGTH ? body.url : null;
    }
  } catch {
    // A body that is not JSON is a bad request.
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const denied = await requireSession(req);
  if (denied) return denied;

  const input = await readUrl(req);
  if (input === null) return Response.json({ error: BAD_URL }, { status: 400 });

  // The limit is used only for well-formed requests.
  let limit: LimitResult;
  try {
    limit = await checkScanLimit(getClientIp(req));
  } catch {
    return Response.json({ error: NOT_AVAILABLE }, { status: 503 });
  }
  if (!limit.ok) return Response.json({ error: limit.message }, { status: 429 });

  try {
    const checked = await normaliseAndValidateUrl(input);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

    const page = await gather(checked.url);
    const scan: ScanResult = {
      id: crypto.randomUUID(),
      url: checked.url,
      finalUrl: page.finalUrl,
      scannedAt: page.scannedAt,
      findings: runChecks(page),
      jsRendered: page.jsRendered,
      loadedWith: page.loadedWith,
      limitations: page.limitations,
    };
    // The client sends scan.url to /api/pagespeed, so the ticket uses the same value.
    const performanceTicket = await issuePerformanceTicket(scan.id, scan.url);
    const response: ScanResponse = { scan, performanceTicket };
    return Response.json(response);
  } catch (error) {
    // Log only a generic message and the error name. Never log the URL or results.
    console.error('Scan failed.', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: SCAN_FAILED }, { status: 500 });
  }
}
