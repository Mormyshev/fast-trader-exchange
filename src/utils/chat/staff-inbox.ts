import type { ChatConversation } from "@/src/utils/chat/types";

const READ_PREFIX = "staff-chat-read:";
export const STAFF_CHAT_READ_EVENT = "staff-chat-read";

export function getStaffChatReadAt(conversationId: string): string | null {
  try {
    return localStorage.getItem(READ_PREFIX + conversationId);
  } catch {
    return null;
  }
}

export function loadStaffChatReadMap(): Record<string, string> {
  const next: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(READ_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value) next[key.slice(READ_PREFIX.length)] = value;
    }
  } catch {
    // ignore
  }
  return next;
}

export function markStaffChatRead(
  conversationId: string,
  lastMessageAt: string | null | undefined,
): string {
  const next = lastMessageAt || new Date().toISOString();
  const prev = getStaffChatReadAt(conversationId);
  const value = prev && prev > next ? prev : next;
  try {
    localStorage.setItem(READ_PREFIX + conversationId, value);
  } catch {
    // ignore quota / private mode
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(STAFF_CHAT_READ_EVENT, {
        detail: { conversationId, readAt: value },
      }),
    );
  }

  return value;
}

export function countUnreadConversations(
  conversations: ChatConversation[],
  readMap?: Record<string, string>,
): number {
  const map = readMap ?? loadStaffChatReadMap();
  return conversations.filter(
    (conversation) =>
      countUnreadClientMessages(
        conversation,
        map[conversation.id] ?? null,
      ) > 0,
  ).length;
}

export function countUnreadClientMessages(
  conversation: ChatConversation,
  readAt: string | null,
): number {
  const tail = conversation.client_message_tail;
  if (tail?.length) {
    if (!readAt) return tail.length;
    return tail.filter((message) => message.created_at > readAt).length;
  }

  const last = conversation.last_message;
  if (!last || last.sender_id !== conversation.user_id) return 0;
  if (!readAt) return 1;
  return last.created_at > readAt ? 1 : 0;
}

export function getClientMessagePreview(
  conversation: ChatConversation,
): string | null {
  const last = conversation.last_message;
  if (!last || last.sender_id !== conversation.user_id) return null;

  const text = last.body?.replace(/\s+/g, " ").trim();
  if (text) return text;
  if (last.attachment_url || last.attachment_name) {
    return last.attachment_name?.trim() || "Вложение";
  }
  return "Новое сообщение";
}
