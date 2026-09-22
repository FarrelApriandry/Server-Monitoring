import type { APIRoute } from 'astro';
import { queryHistory, bucketize } from '../../lib/history';

export const prerender = false;

const RANGES: Record<string, number> = {
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 86_400_000,
};

export const GET: APIRoute = async ({ url }) => {
  const rangeKey = url.searchParams.get('range') || '1h';
  const rangeMs = RANGES[rangeKey] ?? RANGES['1h'];
  const bucketMs = Math.max(5000, Math.round(rangeMs / 180));
  try {
    const rows = await queryHistory(rangeMs);
    const data = bucketize(rows, bucketMs);
    return new Response(JSON.stringify({ range: rangeKey, bucketMs, count: data.length, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'history_unavailable', data: [] }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
