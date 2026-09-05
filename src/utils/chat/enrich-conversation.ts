import { withTimeout } from "@/src/utils/supabase/with-timeout";
import type { ChatConversation, ChatMessage } from "@/src/utils/chat/types";
import { buildAssignedOperatorMeta, buildOperatorMeta } from "@/src/utils/chat/staff-chat";

function mapChatMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    conversation_id: String(row.conversation_id),
    sender_id: String(row.sender_id),
    body: typeof row.body === "string" ? row.body : null,
    attachment_url:
      typeof row.attachment_url === "string" ? row.attachment_url : null,
    attachment_name:
      typeof row.attachment_name === "string" ? row.attachment_name : null,
    attachment_type:
      typeof row.attachment_type === "string" ? row.attachment_type : null,
  };
}

type ConversationPreview = {
  last_message: ChatMessage | null;
  client_message_tail: { id: string; created_at: string }[];
};

async function loadMessagePreviews(
  admin: any,
  rows: Record<string, unknown>[],
): Promise<Map<string, ConversationPreview>> {
  const previews = new Map<string, ConversationPreview>();
  if (rows.length === 0) return previews;

  const results = await Promise.all(
    rows.map((row) =>
      withTimeout(
        admin
          .from("chat_messages")
          .select(
            "id, created_at, conversation_id, sender_id, body, attachment_url, attachment_name, attachment_type",
          )
          .eq("conversation_id", String(row.id))
          .order("created_at", { ascending: false })
          .limit(50),
        8000,
        { data: [], error: null } as any,
      ),
    ),
  );

  results.forEach((result, index) => {
    const conversationId = String(rows[index].id);
    const userId = String(rows[index].user_id);
    const messages = ((result?.data ?? []) as Record<string, unknown>[]).map(
      mapChatMessage,
    );
    const last_message = messages[0] ?? null;
    const client_message_tail: { id: string; created_at: string }[] = [];
    for (const message of messages) {
      if (message.sender_id !== userId) break;
      client_message_tail.push({
        id: message.id,
        created_at: message.created_at,
      });
    }
    previews.set(conversationId, { last_message, client_message_tail });
  });

  return previews;
}

export async function enrichConversations(
  admin: any,
  rows: Record<string, unknown>[],
): Promise<ChatConversation[]> {
  if (!rows.length) return [];

  const profileIds = new Set<string>();
  for (const row of rows) {
    if (typeof row.user_id === "string") profileIds.add(row.user_id);
    if (typeof row.operator_id === "string") profileIds.add(row.operator_id);
  }

  const [{ data: profiles }, previews] = await Promise.all([
    withTimeout(
      admin
        .from("profiles")
        .select("id, email, first_name, last_name, operator_pseudonym, chat_pseudonym, role, is_senior_operator")
        .in("id", [...profileIds]),
      8000,
      { data: [], error: null } as any,
    ),
    loadMessagePreviews(admin, rows),
  ]);

  const byId = new Map<string, Record<string, unknown>>(
    (profiles ?? []).map((p: Record<string, unknown>) => [String(p.id), p]),
  );

  return rows.map((row) => {
    const user = byId.get(String(row.user_id));
    const operatorProfile = row.operator_id
      ? byId.get(String(row.operator_id))
      : null;
    const preview = previews.get(String(row.id));
    const lastMessage = preview?.last_message ?? null;
    const unanswered = Boolean(
      lastMessage && lastMessage.sender_id === String(row.user_id),
    );

    return {
      id: String(row.id),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      user_id: String(row.user_id),
      operator_id: row.operator_id ? String(row.operator_id) : null,
      status: String(row.status),
      user: user
        ? {
            email: String(
              typeof user.email === "string" ? user.email : "",
            ),
            first_name:
              typeof user.first_name === "string" ? user.first_name : null,
            last_name:
              typeof user.last_name === "string" ? user.last_name : null,
          }
        : undefined,
      operator: buildOperatorMeta(row, operatorProfile),
      assigned_operator: buildAssignedOperatorMeta(row, operatorProfile),
      last_message: lastMessage,
      unread: unanswered,
      client_message_tail: preview?.client_message_tail ?? [],
    };
  });
}

export async function enrichConversation(
  admin: any,
  row: Record<string, unknown>,
): Promise<ChatConversation> {
  const [conversation] = await enrichConversations(admin, [row]);
  return conversation;
}
