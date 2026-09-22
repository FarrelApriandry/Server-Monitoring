import type { APIRoute } from 'astro';
import { getStaticSystemInfo } from '../../lib/system';

export const prerender = false;

export const GET: APIRoute = async () => {
  const info = await getStaticSystemInfo();
  if (!info) {
    return new Response(JSON.stringify({ error: 'system_info_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(info), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
