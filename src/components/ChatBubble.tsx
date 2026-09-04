"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconChat } from "./icons";

/**
 * Messages, reachable from anywhere.
 *
 * A bubble rather than a menu entry, because messaging is not a place you
 * navigate to on purpose so much as something that interrupts you: it wants to
 * be within reach of a thumb on every screen, and to be able to ask for
 * attention. It pulses while anything is unread and goes quiet once it is read.
 *
 * It hides itself on the messages page, where it would only cover the thread.
 */
export default function ChatBubble({ unread }: { unread: number }) {
  const path = usePathname();
  const [live, setLive] = useState(unread);

  // the stream in the messages page broadcasts; anywhere else, a new message
  // still has to light this up, so listen for the same event
  useEffect(() => {
    const bump = () => setLive((n) => n + 1);
    window.addEventListener("fp:messages", bump);
    return () => window.removeEventListener("fp:messages", bump);
  }, []);

  // the server's count is the truth whenever the page re-renders
  const [wasUnread, setWasUnread] = useState(unread);
  if (unread !== wasUnread) {
    setWasUnread(unread);
    setLive(unread);
  }

  if (path.startsWith("/messages")) return null;

  const n = live;
  return (
    <Link
      href="/messages"
      className={`chat-fab ${n > 0 ? "chat-fab-alert" : ""}`}
      aria-label={n > 0 ? `Messages — ${n} unread` : "Messages"}
    >
      <IconChat className="h-[23px] w-[23px]" />
      {n > 0 && <span className="chat-fab-count">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}
