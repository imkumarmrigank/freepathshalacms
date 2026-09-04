-- Staff talk to each other about a child, a class, a delivery. Until now that
-- happened on WhatsApp, where it is invisible to the organisation and lost when
-- somebody leaves. Conversations live here instead.
CREATE TABLE IF NOT EXISTS conversations (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('direct', 'centre', 'group')),
  -- set for a centre's room; null for a direct message or an ad-hoc group
  center_id   BIGINT REFERENCES centers(id) ON DELETE CASCADE,
  title       TEXT,
  created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- kept up to date on every send so the list can be ordered without a join
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- the id of the last message this person has seen, so unread is a comparison
  last_read_id    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages (conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_convo_recent ON conversations (last_message_at DESC);

-- One direct conversation per pair, whichever of the two opens it first. The
-- pair is normalised into the key so (A,B) and (B,A) collide rather than
-- creating two threads that each hold half the conversation.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS direct_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_direct_pair
  ON conversations (direct_key) WHERE kind = 'direct';

-- One room per centre.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_centre_room
  ON conversations (center_id) WHERE kind = 'centre';
