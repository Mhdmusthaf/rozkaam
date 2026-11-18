// A small in-memory rate limiter for sign-in. It counts calls per caller
// address and per phone number in a rolling minute. One server instance is
// assumed; move the counters to the database or Redis when there are several.
import type { Context } from 'hono';

import { now } from './clock';
import { AppError } from './errors';

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function allow(key: string, perMinute: number) {
  const t = now().getTime();
  const recent = (hits.get(key) ?? []).filter((x) => t - x < WINDOW_MS);
  if (recent.length >= perMinute) {
    hits.set(key, recent);
    return false;
  }
  recent.push(t);
  hits.set(key, recent);
  // Keep the map from growing without bound.
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < WINDOW_MS)) hits.delete(k);
  return true;
}

export const rateLimit = (opts: { perMinute: number }) => async (c: Context, next: () => Promise<void>) => {
  const address = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const phone = await c.req
    .raw.clone()
    .json()
    .then((b: { phone?: unknown }) => (typeof b?.phone === 'string' ? b.phone.replace(/\D/g, '').slice(-10) : ''))
    .catch(() => '');
  // The address limit is looser because many people can share one network.
  if (!allow(`ip:${address}`, opts.perMinute * 5) || (phone && !allow(`ph:${phone}`, opts.perMinute))) {
    throw new AppError(429, 'too_many_requests', 'Too many attempts. Wait a minute and try again.');
  }
  await next();
};
