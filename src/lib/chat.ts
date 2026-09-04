import "server-only";
import { EventEmitter } from "node:events";
import { one, query, tx } from "./db";
import type { SessionUser } from "./auth";
import { isGlobalRole } from "./roles";

/**
 * Staff messaging.
 *
 * Delivery is a server-sent stream rather than a socket: chat only needs the
 * server to push, the browser posts what it sends, and an SSE stream is a plain
 * route handler where a socket would need a custom server. On one instance the
 * bus below wakes a listener the moment a message lands; the stream also re-reads
 * on a short timer, so a second instance — or a missed event — costs a second's
 * delay rather than a lost message.
 */
const bus = new EventEmitter();
bus.setMaxListeners(200);

export function announce(conversationId: number) {
  bus.emit("message", conversationId);
}

export function onMessage(fn: (conversationId: number) => void) {
  bus.on("message", fn);
  return () => { bus.off("message", fn); };
}

export type Conversation = {
  id: number;
  kind: "direct" | "centre" | "group";
  title: string;
  subtitle: string | null;
  last_message_at: string;
  preview: string | null;
  unread: number;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender_name: string | null;
  body: string;
  created_at: string;
};

/** The pair key that keeps A→B and B→A one thread. */
const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(":");

/** Every conversation this person is in, most recently spoken in first. */
export async function listConversations(userId: number): Promise<Conversation[]> {
  return query<Conversation>(
    `SELECT c.id, c.kind, c.last_message_at,
            COALESCE(
              c.title,
              CASE WHEN c.kind = 'centre' THEN ce.name || ' — everyone'
                   ELSE (SELECT u.name FROM conversation_members m2
                           JOIN users u ON u.id = m2.user_id
                          WHERE m2.conversation_id = c.id AND m2.user_id <> $1
                          LIMIT 1)
              END, 'Conversation') AS title,
            CASE WHEN c.kind = 'direct'
                 THEN (SELECT COALESCE(u.designation, u.role)
                         FROM conversation_members m3
                         JOIN users u ON u.id = m3.user_id
                        WHERE m3.conversation_id = c.id AND m3.user_id <> $1 LIMIT 1)
                 ELSE ce.name END AS subtitle,
            (SELECT left(x.body, 90) FROM messages x
              WHERE x.conversation_id = c.id ORDER BY x.id DESC LIMIT 1) AS preview,
            (SELECT count(*) FROM messages x
              WHERE x.conversation_id = c.id AND x.id > m.last_read_id
                AND x.sender_id <> $1) AS unread
       FROM conversation_members m
       JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN centers ce ON ce.id = c.center_id
      WHERE m.user_id = $1
      ORDER BY c.last_message_at DESC`,
    [userId],
  );
}

/** One number for the sidebar. */
export async function unreadTotal(userId: number): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*) AS n
       FROM conversation_members m
       JOIN messages x ON x.conversation_id = m.conversation_id
      WHERE m.user_id = $1 AND x.id > m.last_read_id AND x.sender_id <> $1`,
    [userId]);
  return Number(row?.n ?? 0);
}

/**
 * The newest message id in anything this person is in. The live stream starts
 * here, so opening a page means "tell me what happens from now" rather than
 * replaying the day.
 */
export async function latestMessageId(userId: number): Promise<number> {
  const row = await one<{ id: string | null }>(
    `SELECT max(x.id) AS id
       FROM messages x
       JOIN conversation_members m
         ON m.conversation_id = x.conversation_id AND m.user_id = $1`,
    [userId]);
  return Number(row?.id ?? 0);
}

export async function isMember(conversationId: number, userId: number) {
  const row = await one<{ user_id: number }>(
    "SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    [conversationId, userId]);
  return Boolean(row);
}

/** A page of a thread, oldest first so it reads top to bottom. */
export async function readMessages(conversationId: number, afterId = 0, limit = 200) {
  return query<ChatMessage>(
    `SELECT x.id, x.conversation_id, x.sender_id, u.name AS sender_name,
            x.body, x.created_at
       FROM messages x
       LEFT JOIN users u ON u.id = x.sender_id
      WHERE x.conversation_id = $1 AND x.id > $2
      ORDER BY x.id
      LIMIT $3`,
    [conversationId, afterId, limit],
  );
}

/** Anything new for this person across every conversation they are in. */
export async function messagesSince(userId: number, afterId: number) {
  return query<ChatMessage>(
    `SELECT x.id, x.conversation_id, x.sender_id, u.name AS sender_name,
            x.body, x.created_at
       FROM messages x
       JOIN conversation_members m
         ON m.conversation_id = x.conversation_id AND m.user_id = $1
       LEFT JOIN users u ON u.id = x.sender_id
      WHERE x.id > $2
      ORDER BY x.id
      LIMIT 100`,
    [userId, afterId],
  );
}

/** Opens the thread with somebody, or returns the one that already exists. */
export async function directWith(userId: number, otherId: number): Promise<number> {
  const key = pairKey(userId, otherId);
  const found = await one<{ id: number }>(
    "SELECT id FROM conversations WHERE kind = 'direct' AND direct_key = $1", [key]);
  if (found) return found.id;

  return tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO conversations (kind, direct_key, created_by)
       VALUES ('direct', $1, $2)
       ON CONFLICT (direct_key) WHERE kind = 'direct' DO NOTHING
       RETURNING id`,
      [key, userId]);

    if (rows[0]) {
      await c.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1,$2), ($1,$3) ON CONFLICT DO NOTHING`,
        [rows[0].id, userId, otherId]);
      return rows[0].id;
    }
    // somebody else opened it in the same moment
    const { rows: again } = await c.query<{ id: number }>(
      "SELECT id FROM conversations WHERE kind = 'direct' AND direct_key = $1", [key]);
    return again[0].id;
  });
}

/**
 * The room for a centre, with everyone who works there in it. Membership is
 * refreshed on open, so somebody who joined the centre last week is in the room
 * without anybody having to add them.
 */
export async function centreRoom(centerId: number): Promise<number> {
  const found = await one<{ id: number }>(
    "SELECT id FROM conversations WHERE kind = 'centre' AND center_id = $1", [centerId]);

  const id = found?.id ?? await tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO conversations (kind, center_id) VALUES ('centre', $1)
       ON CONFLICT (center_id) WHERE kind = 'centre' DO NOTHING RETURNING id`,
      [centerId]);
    if (rows[0]) return rows[0].id;
    const { rows: again } = await c.query<{ id: number }>(
      "SELECT id FROM conversations WHERE kind = 'centre' AND center_id = $1", [centerId]);
    return again[0].id;
  });

  await query(
    `INSERT INTO conversation_members (conversation_id, user_id)
     SELECT $1, u.id FROM users u
      WHERE u.is_active AND u.center_id = $2
     ON CONFLICT DO NOTHING`,
    [id, centerId]);

  return id;
}

/** Writes the message and wakes anybody listening on this instance. */
export async function send(conversationId: number, senderId: number, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Nothing to send.");

  const row = await tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1,$2,$3) RETURNING id`,
      [conversationId, senderId, trimmed.slice(0, 4000)]);
    await c.query(
      "UPDATE conversations SET last_message_at = now() WHERE id = $1", [conversationId]);
    // the sender has, by definition, read their own message
    await c.query(
      `UPDATE conversation_members SET last_read_id = $3
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, senderId, rows[0].id]);
    return rows[0];
  });

  announce(conversationId);
  return row.id;
}

export async function markRead(conversationId: number, userId: number) {
  await query(
    `UPDATE conversation_members
        SET last_read_id = COALESCE(
          (SELECT max(id) FROM messages WHERE conversation_id = $1), last_read_id)
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]);
}

/** Who this person may start a conversation with. */
export async function contactsFor(user: SessionUser) {
  const params: unknown[] = [user.uid];
  let scope = "";
  if (!isGlobalRole(user.role)) {
    // a teacher or manager talks to their own centre, and to the people who
    // work across every centre
    params.push(user.centerId ?? -1);
    scope = ` AND (u.center_id = $${params.length} OR u.center_id IS NULL)`;
  }
  return query<{
    id: number; name: string; role: string; designation: string | null;
    center_name: string | null;
  }>(
    `SELECT u.id, u.name, u.role, u.designation, c.name AS center_name
       FROM users u
       LEFT JOIN centers c ON c.id = u.center_id
      WHERE u.is_active AND u.id <> $1 ${scope}
      ORDER BY u.name`,
    params,
  );
}
