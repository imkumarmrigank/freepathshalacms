"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/chat";

/**
 * Holds the one server-sent stream the page needs and re-broadcasts what
 * arrives as a window event, so the thread and the conversation list both hear
 * it without either owning the connection. One stream per tab, not per panel.
 *
 * EventSource reconnects on its own; the cursor moves forward as messages
 * arrive so a reconnection resumes rather than replaying.
 */
export default function Live({ after }: { after: number }) {
  const router = useRouter();

  useEffect(() => {
    let cursor = after;
    let es: EventSource | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (stopped) return;
      es = new EventSource(`/api/chat/stream?after=${cursor}`);

      es.addEventListener("messages", (e) => {
        let rows: ChatMessage[] = [];
        try { rows = JSON.parse((e as MessageEvent).data); } catch { return; }
        if (rows.length === 0) return;
        cursor = Math.max(cursor, ...rows.map((r) => Number(r.id)));
        window.dispatchEvent(new CustomEvent("fp:messages", { detail: rows }));
        // the list of conversations, its ordering and the unread badges are
        // rendered on the server, so ask for them again
        router.refresh();
      });

      es.onerror = () => {
        // reopen from where we left off rather than letting the browser replay
        es?.close();
        es = null;
        if (!stopped) retry = setTimeout(open, 3000);
      };
    };

    open();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [after, router]);

  return null;
}
