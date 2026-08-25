-- Внутренний чат команды: общий канал + личные сообщения.
-- Выполните в SQL Editor Supabase.

CREATE TABLE IF NOT EXISTS staff_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL CHECK (kind IN ('group', 'dm')),
  peer_a UUID REFERENCES profiles(id) ON DELETE CASCADE,
  peer_b UUID REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT staff_conversations_dm_peers_check CHECK (
    (kind = 'group' AND peer_a IS NULL AND peer_b IS NULL)
    OR (
      kind = 'dm'
      AND peer_a IS NOT NULL
      AND peer_b IS NOT NULL
      AND peer_a < peer_b
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_conversations_one_group
  ON staff_conversations ((true))
  WHERE kind = 'group';

CREATE UNIQUE INDEX IF NOT EXISTS staff_conversations_dm_pair
  ON staff_conversations (peer_a, peer_b)
  WHERE kind = 'dm';

CREATE INDEX IF NOT EXISTS idx_staff_conversations_kind
  ON staff_conversations (kind);

CREATE TABLE IF NOT EXISTS staff_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversation_id UUID NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_messages_conversation_id
  ON staff_messages (conversation_id, created_at ASC);

ALTER TABLE staff_messages REPLICA IDENTITY FULL;
ALTER TABLE staff_conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'staff_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'staff_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff_conversations;
  END IF;
END $$;
