import { getPerformanceProvider } from '@/lib/performance';
import { checkPageSpeedLimit, getClientIp, type LimitResult } from '@/lib/ratelimit';
import { requireSession } from '@/lib/security/session';
import { normaliseAndValidateUrl } from '@/lib/security/url';
import { redeemPerformanceTicket, verifyPerformanceTicket } from '@/lib/tickets';

export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_URL_LENGTH = 2048;
const MAX_TICKET_LENGTH = 4096;
const BAD_URL = 'Enter a valid website address.';
const NOT_AVAILABLE = 'The service is not available. Try again later.';
const CHECK_FAILED = 'Performance check failed. Please try again.';

async function readBody(req: Request): Promise<{ url: string; ticket: string } | null> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object' && 'url' in body && 'ticket' in body) {
      const { url, ticket } = body;
      if (
        typeof url === 'string' && url.length <= MAX_URL_LENGTH &&
        typeof ticket === 'string' && ticket !== '' && ticket.length <= MAX_TICKET_LENGTH
      ) {
        return { url, ticket };
      }
    }
  } catch {
    // A body that is not JSON is a bad request.
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const denied = await requireSession(req);
  if (denied) return denied;

  const body = await readBody(req);
  if (body === null) return Response.json({ error: BAD_URL }, { status: 400 });

  try {
    const checked = await normaliseAndValidateUrl(body.url);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

    // Check the ticket first. A bad, expired or mismatched ticket must not use a limiter slot.
    // This check is stateless. It does not use the ticket.
    const verified = await verifyPerformanceTicket(body.ticket, checked.url);
    if (!verified.ok) return Response.json({ error: verified.error }, { status: 403 });

    let limit: LimitResult;
    try {
      limit = await checkPageSpeedLimit(getClientIp(req));
    } catch {
      return Response.json({ error: NOT_AVAILABLE }, { status: 503 });
    }
    if (!limit.ok) return Response.json({ error: limit.message }, { status: 429 });

    // The ticket belongs to the validated URL that /api/scan issued it for. SET NX uses it once.
    const redeemed = await redeemPerformanceTicket(body.ticket, checked.url);
    if (!redeemed.ok) return Response.json({ error: redeemed.error }, { status: 403 });

    // Both a result and an unavailable outcome are a normal 200 response.
    const outcome = await getPerformanceProvider().fetch(checked.url);
    return Response.json(outcome);
  } catch (error) {
    // Log only the error name. Never log the URL or results.
    console.error('Performance check failed.', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: CHECK_FAILED }, { status: 500 });
  }
}
