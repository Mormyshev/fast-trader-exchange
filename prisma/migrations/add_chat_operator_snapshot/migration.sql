ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS operator_pseudonym_snapshot TEXT;
