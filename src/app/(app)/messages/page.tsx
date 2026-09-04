import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { centersForUser } from "@/lib/queries";
import { Card, Empty, PageHeader } from "@/components/ui";
import {
  contactsFor, isMember, listConversations, markRead, readMessages,
} from "@/lib/chat";
import Thread from "./Thread";
import Live from "./Live";
import StartChat from "./StartChat";

export const metadata = { title: "Messages · FreePathshala CMS" };

export default async function MessagesPage({
  searchParams,
}: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const [conversations, people, centres] = await Promise.all([
    listConversations(user.uid),
    contactsFor(user),
    centersForUser(user),
  ]);

  const wanted = Number(sp.c) || conversations[0]?.id || null;
  const open = wanted && await isMember(wanted, user.uid) ? wanted : null;

  const messages = open ? await readMessages(open) : [];
  if (open) await markRead(open, user.uid);

  const current = conversations.find((c) => c.id === open) ?? null;
  // the stream resumes from the newest message already on the page
  const after = messages.length ? messages[messages.length - 1].id : 0;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Talk to anyone at your centre, or across the organisation"
      />

      <Live after={after} />

      <Card pad={false} className="overflow-hidden">
        <div className="grid min-h-[32rem] md:grid-cols-[19rem_minmax(0,1fr)]">
          {/* ------------------------------------------------ the conversations */}
          <aside className="flex min-h-0 flex-col border-b border-[var(--border)] md:border-b-0 md:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-[var(--muted)]">
                  No conversations yet. Pick somebody below to start one.
                </p>
              ) : (
                <ul>
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link href={`/messages?c=${c.id}`}
                        className={`block border-b border-[#f1f1f6] px-4 py-3 hover:bg-[#fafaff] ${
                          c.id === open ? "bg-[var(--brand-soft)]" : ""}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                            {c.title}
                          </span>
                          {c.unread > 0 && (
                            <span className="chat-badge">{c.unread}</span>
                          )}
                        </div>
                        {c.preview && (
                          <div className="truncate text-[12.5px] text-[var(--muted)]">
                            {c.preview}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <StartChat people={people} centres={centres} />
          </aside>

          {/* -------------------------------------------------------- the thread */}
          <section className="min-h-0">
            {open && current ? (
              <Thread conversationId={open} me={user.uid} initial={messages}
                title={current.title} subtitle={current.subtitle} />
            ) : (
              <Empty title="No conversation open"
                hint="Choose one on the left, or start a new one." />
            )}
          </section>
        </div>
      </Card>
    </>
  );
}
