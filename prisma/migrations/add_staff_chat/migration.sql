  -- Внутренний чат команды: общий канал + личные сообщения между сотрудниками
  CREATE TABLE IF NOT EXISTS "staff_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "kind" TEXT NOT NULL,
    "peer_a" UUID,
    "peer_b" UUID,
    CONSTRAINT "staff_conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_conversations_kind_check" CHECK ("kind" IN ('group', 'dm')),
    CONSTRAINT "staff_conversations_dm_peers_check" CHECK (
      ("kind" = 'group' AND "peer_a" IS NULL AND "peer_b" IS NULL)
      OR (
        "kind" = 'dm'
        AND "peer_a" IS NOT NULL
        AND "peer_b" IS NOT NULL
        AND "peer_a" < "peer_b"
      )
    )
  );

  ALTER TABLE "staff_conversations"
    ADD CONSTRAINT "staff_conversations_peer_a_fkey"
    FOREIGN KEY ("peer_a") REFERENCES "profiles"("id") ON DELETE CASCADE;

  ALTER TABLE "staff_conversations"
    ADD CONSTRAINT "staff_conversations_peer_b_fkey"
    FOREIGN KEY ("peer_b") REFERENCES "profiles"("id") ON DELETE CASCADE;

  CREATE UNIQUE INDEX IF NOT EXISTS "staff_conversations_one_group"
    ON "staff_conversations" ((true))
    WHERE "kind" = 'group';

  CREATE UNIQUE INDEX IF NOT EXISTS "staff_conversations_dm_pair"
    ON "staff_conversations" ("peer_a", "peer_b")
    WHERE "kind" = 'dm';

  CREATE INDEX IF NOT EXISTS "idx_staff_conversations_kind"
    ON "staff_conversations" ("kind");

  CREATE TABLE IF NOT EXISTS "staff_conversation_reads" (
    "conversation_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "staff_conversation_reads_pkey" PRIMARY KEY ("conversation_id", "profile_id")
  );

  ALTER TABLE "staff_conversation_reads"
    ADD CONSTRAINT "staff_conversation_reads_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "staff_conversations"("id") ON DELETE CASCADE;

  ALTER TABLE "staff_conversation_reads"
    ADD CONSTRAINT "staff_conversation_reads_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

  CREATE TABLE IF NOT EXISTS "staff_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "attachment_type" TEXT,
    CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id")
  );

  ALTER TABLE "staff_messages"
    ADD CONSTRAINT "staff_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "staff_conversations"("id") ON DELETE CASCADE;

  ALTER TABLE "staff_messages"
    ADD CONSTRAINT "staff_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

  CREATE INDEX IF NOT EXISTS "idx_staff_messages_conversation_id"
    ON "staff_messages" ("conversation_id", "created_at" ASC);

  ALTER TABLE "staff_messages" REPLICA IDENTITY FULL;
  ALTER TABLE "staff_conversations" REPLICA IDENTITY FULL;

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
