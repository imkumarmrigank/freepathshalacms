"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendMessage, readConversation } from "./actions";
import { candidates, toDevanagari } from "@/lib/hindi";
import type { ChatMessage } from "@/lib/chat";

/**
 * One conversation, kept live by the stream opened in Live.tsx.
 *
 * Sending puts the message on screen straight away and lets the server confirm
 * it — over a slow connection at a centre, waiting for a round trip before the
 * text appears makes the whole thing feel broken.
 */
export default function Thread({
  conversationId, me, initial, title, subtitle,
}: {
  conversationId: number;
  me: number;
  initial: ChatMessage[];
  title: string;
  subtitle: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [pending, setPending] = useState<{ key: string; body: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Hindi typing, the same as the teaching plans: type the sound and press
  // space. Kept per browser, because whoever writes in Hindi does so every time.
  // read once, at mount, so the first paint already has the right keyboard
  const [hindi, setHindi] = useState(() => {
    try { return localStorage.getItem("fp-chat-hindi") === "1"; } catch { return false; }
  });
  const [text, setText] = useState("");     // what has already been converted
  const [buf, setBuf] = useState("");       // the Latin word still being typed
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const setLanguage = (on: boolean) => {
    setHindi(on);
    setBuf("");
    try { localStorage.setItem("fp-chat-hindi", on ? "1" : "0"); } catch { /* fine */ }
  };

  const picks = hindi && buf ? candidates(buf) : [];

  // the stream hands new messages to the window; take the ones for this thread
  useEffect(() => {
    const onIncoming = (e: Event) => {
      const rows = (e as CustomEvent<ChatMessage[]>).detail;
      const mine = rows.filter((r) => Number(r.conversation_id) === conversationId);
      if (mine.length === 0) return;
      setMessages((cur) => {
        const seen = new Set(cur.map((m) => m.id));
        const added = mine.filter((m) => !seen.has(m.id));
        if (added.length === 0) return cur;
        // anything of mine that arrived is no longer pending
        setPending((p) => p.filter((q) => !added.some((a) =>
          a.sender_id === me && a.body === q.body)));
        return [...cur, ...added].sort((a, b) => a.id - b.id);
      });
    };
    window.addEventListener("fp:messages", onIncoming);
    return () => window.removeEventListener("fp:messages", onIncoming);
  }, [conversationId, me]);

  // stay at the foot as messages arrive
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  // opening the thread clears its badge
  useEffect(() => {
    void readConversation(conversationId);
  }, [conversationId, messages.length]);

  const compose = (next: string) => {
    if (!hindi) { setText(next); return; }
    // everything past `text` is the word in progress; a space or a mark ends it
    if (!next.startsWith(text)) { setText(next); setBuf(""); return; }
    const tail = next.slice(text.length);
    if (/[^A-Za-z]/.test(tail)) { setText(text + toDevanagari(tail)); setBuf(""); return; }
    setBuf(tail);
  };

  const take = (word: string) => { setText(text + word); setBuf(""); inputRef.current?.focus(); };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = (text + (buf ? toDevanagari(buf) : "")).trim();
    if (!body) return;

    const key = `${Date.now()}-${Math.random()}`;
    setPending((p) => [...p, { key, body }]);
    setText("");
    setBuf("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setError(null);

    const fd = new FormData();
    fd.set("conversation_id", String(conversationId));
    fd.set("body", body);
    const res = await sendMessage(null, fd);
    if (res?.error) {
      setPending((p) => p.filter((q) => q.key !== key));
      setError(res.error);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex-none border-b border-[var(--border)] px-4 py-3">
        <div className="text-[15px] font-semibold">{title}</div>
        {subtitle && <div className="text-[12px] text-[var(--muted)]">{subtitle}</div>}
      </header>

      <div ref={boxRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {messages.length === 0 && pending.length === 0 && (
          <p className="py-8 text-center text-[13px] text-[var(--muted)]">
            Nothing here yet. Say hello.
          </p>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === me;
          const runOn = i > 0 && messages[i - 1].sender_id === m.sender_id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`chat-bubble ${mine ? "chat-mine" : "chat-theirs"}`}>
                {!mine && !runOn && (
                  <div className="chat-who">{m.sender_name ?? "Someone"}</div>
                )}
                <div className="chat-body">{m.body}</div>
                <time className="chat-time" dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit", minute: "2-digit", hour12: true,
                  })}
                </time>
              </div>
            </div>
          );
        })}

        {pending.map((p) => (
          <div key={p.key} className="flex justify-end">
            <div className="chat-bubble chat-mine chat-pending">
              <div className="chat-body">{p.body}</div>
              <time className="chat-time">sending…</time>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex-none px-4 pb-2 text-[13px] text-[var(--bad)]">{error}</div>
      )}

      <div className="flex-none border-t border-[var(--border)]">
        {picks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--faint)]">
              {buf}
            </span>
            {picks.map((p, i) => (
              <button key={p} type="button" onClick={() => take(p)}
                className={`hindi-pick ${i === 0 ? "hindi-pick-on" : ""}`}>
                {p}
              </button>
            ))}
            <span className="text-[11px] text-[var(--faint)]">space to accept</span>
          </div>
        )}

        <form onSubmit={submit} className="flex items-end gap-2 p-3">
          <button type="button" onClick={() => setLanguage(!hindi)}
            title={hindi ? "Switch to English" : "हिंदी में लिखें"}
            className={`hindi-chip mb-[7px] ${hindi ? "hindi-chip-on" : ""}`}>
            {hindi ? "अ" : "A"}
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={text + buf}
            lang={hindi ? "hi" : "en"}
            placeholder={hindi ? "संदेश लिखें" : "Write a message"}
            className="textarea max-h-32 flex-1 resize-none"
            onChange={(e) => compose(e.currentTarget.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter starts a line
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
