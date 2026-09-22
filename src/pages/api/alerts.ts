import type { APIRoute } from 'astro';
import { listAlerts } from '../../lib/history';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const raw = url.searchParams.get('since');
  const since = raw && !Number.isNaN(Number(raw)) ? Number(raw) : Date.now() - 3_600_000;
  const alerts = await listAlerts(since);
  return new Response(JSON.stringify({ alerts }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
