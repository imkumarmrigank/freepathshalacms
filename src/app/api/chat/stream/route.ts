import { getSession } from "@/lib/auth";
import { messagesSince, onMessage } from "@/lib/chat";

export const dynamic = "force-dynamic";
// a stream has to stay open, so it must not be buffered or cached anywhere
export const fetchCache = "force-no-store";

/** How often the stream re-reads even when nothing woke it. */
const SWEEP_MS = 1500;
/** A comment down the wire, so proxies do not close a quiet connection. */
const PING_MS = 25_000;

/**
 * The live half of messaging: the browser POSTs what it sends and listens here
 * for everything else. Server-sent events rather than a socket, because chat
 * only needs the server to push and this is a plain route handler.
 */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  let cursor = Number(url.searchParams.get("after") ?? 0) || 0;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(s)); } catch { closed = true; }
      };
      const event = (name: string, data: unknown) =>
        write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      // tell the browser how long to wait before reconnecting itself
      write("retry: 3000\n\n");

      let due = true;
      const wake = () => { due = true; };
      const off = onMessage(wake);

      const flush = async () => {
        const rows = await messagesSince(user.uid, cursor);
        if (rows.length === 0) return;
        cursor = rows[rows.length - 1].id;
        event("messages", rows);
      };

      await flush();

      const sweep = setInterval(async () => {
        if (closed) return;
        if (!due) return;
        due = false;
        try { await flush(); } catch { /* a bad read should not kill the stream */ }
      }, SWEEP_MS);

      // the sweep only runs when something woke it, so a heartbeat keeps the
      // connection from being reaped, and re-arms the sweep periodically
      const ping = setInterval(() => {
        write(": ping\n\n");
        due = true;
      }, PING_MS);

      const stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(sweep);
        clearInterval(ping);
        off();
        try { controller.close(); } catch { /* already gone */ }
      };

      req.signal.addEventListener("abort", stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx and friends buffer by default, which would hold every message
      "X-Accel-Buffering": "no",
    },
  });
}
