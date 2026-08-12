-- Close open support chats where the "client" is actually staff
UPDATE chat_conversations cc
SET status = 'closed',
    updated_at = now()
FROM profiles p
WHERE cc.user_id = p.id
  AND p.role IN ('operator', 'admin')
  AND cc.status = 'open';
