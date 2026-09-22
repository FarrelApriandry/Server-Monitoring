import type { APIRoute } from 'astro';
import { getMetricsForPoll } from '../../lib/telemetry';

export const prerender = false;

/** Polling fallback endpoint; serves the broker's cached sample. */
export const GET: APIRoute = async () => {
  try {
    const metrics = await getMetricsForPoll();
    if (metrics) {
      return new Response(JSON.stringify(metrics), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }
    return new Response(JSON.stringify({ error: 'telemetry_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'telemetry_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
