import type { APIRoute } from 'astro';
import { getBrokerStatus, getServerStartedAt } from '../../lib/telemetry';

export const prerender = false;

/** Public liveness endpoint (useful for uptime checks / reverse proxies). */
export const GET: APIRoute = () => {
  const status = getBrokerStatus();
  return new Response(
    JSON.stringify({
      status: 'ok',
      ts: Date.now(),
      uptimeSec: Math.round((Date.now() - getServerStartedAt()) / 1000),
      telemetry: status,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
};
