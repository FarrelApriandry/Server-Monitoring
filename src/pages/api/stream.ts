import type { APIRoute } from 'astro';
import { subscribe, getLatestMetrics } from '../../lib/telemetry';

export const prerender = false;

/**
 * Server-Sent Events stream.
 *
 * A single server-side collector (see lib/telemetry) fans out every sample to
 * all connected clients. Data events carry the metrics snapshot; `alert`
 * events carry threshold alerts; `status` events carry collector errors.
 * A comment heartbeat keeps proxies from dropping idle connections.
 */
export const GET: APIRoute = async ({ request }) => {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };

      cleanup = subscribe((msg) => {
        if (msg.kind === 'metrics') {
          send(`data: ${JSON.stringify(msg.metrics)}\n\n`);
        } else if (msg.kind === 'alert') {
          send(`event: alert\ndata: ${JSON.stringify(msg.alert)}\n\n`);
        } else {
          send(`event: status\ndata: ${JSON.stringify({ error: msg.error })}\n\n`);
        }
      });

      // Send the freshest snapshot immediately, then rely on the broker.
      const latest = getLatestMetrics();
      if (latest) send(`retry: 5000\n\ndata: ${JSON.stringify(latest)}\n\n`);

      heartbeat = setInterval(() => send(`: ping\n\n`), 15_000);

      const runCleanup = () => {
        if (cleanup) {
          const fn = cleanup;
          cleanup = null;
          fn();
        }
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      if (request.signal?.aborted) {
        runCleanup();
        return;
      }
      request.signal?.addEventListener?.('abort', runCleanup);
    },
    cancel() {
      if (cleanup) {
        const fn = cleanup;
        cleanup = null;
        fn();
      }
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
