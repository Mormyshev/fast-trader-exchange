import { withTimeout } from "@/src/utils/supabase/with-timeout";
import type { ChatMessage } from "@/src/utils/chat/types";

export const STAFF_TEAM_CHAT_READ_EVENT = "staff-team-chat-read";

export type StaffChatKind = "group" | "dm";

export type StaffChatPeer = {
  id: string;
  email: string;
  role: "operator" | "admin";
  operator_pseudonym: string | null;
  staff_active: boolean;
};

export type StaffChatMessage = ChatMessage;

export type StaffChatConversation = {
  id: string;
  kind: StaffChatKind;
  created_at: string;
  updated_at: string;
  peer: StaffChatPeer | null;
  last_message: StaffChatMessage | null;
  unread: boolean;
};

const STAFF_PROFILE_SELECT =
  "id, email, role, operator_pseudonym, staff_active";

const MESSAGE_SELECT =
  "id, created_at, conversation_id, sender_id, body, attachment_url, attachment_name, attachment_type";

export function staffDisplayName(peer: {
  operator_pseudonym?: string | null;
  email?: string | null;
}) {
  return peer.operator_pseudonym?.trim() || peer.email?.trim() || "Сотрудник";
}

export function orderPeerIds(a: string, b: string): [string, string] {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left < right ? [left, right] : [right, left];
}

export function isStaffChatTableMissing(message: string | null | undefined) {
  if (!message) return false;
  return (
    /staff_conversations|staff_messages|staff_conversation_reads/i.test(
      message,
    ) ||
    /schema cache/i.test(message) ||
    /does not exist/i.test(message)
  );
}

export function canAccessStaffConversation(
  row: { kind?: string; peer_a?: string | null; peer_b?: string | null },
  userId: string,
) {
  if (row.kind === "group") return true;
  return row.peer_a === userId || row.peer_b === userId;
}

export function otherPeerId(
  row: { kind?: string; peer_a?: string | null; peer_b?: string | null },
  userId: string,
) {
  if (row.kind !== "dm") return null;
  return row.peer_a === userId ? row.peer_b : row.peer_a;
}

export function mapStaffPeer(row: {
  id: string;
  email: string;
  role?: string | null;
  operator_pseudonym?: string | null;
  staff_active?: boolean | null;
}): StaffChatPeer {
  return {
    id: row.id,
    email: row.email,
    role: row.role === "admin" ? "admin" : "operator",
    operator_pseudonym: row.operator_pseudonym?.trim() || null,
    staff_active: row.staff_active === true,
  };
}

export function attachMessageSender(
  message: StaffChatMessage,
  profiles: Map<string, StaffChatPeer>,
): StaffChatMessage {
  const sender = profiles.get(message.sender_id);
  if (!sender) return message;
  return {
    ...message,
    sender: {
      role: sender.role,
      operator_pseudonym: sender.operator_pseudonym,
      email: sender.email,
    },
  };
}

export function buildStaffConversation(
  row: {
    id: string;
    kind: string;
    created_at: string;
    updated_at: string;
    peer_a?: string | null;
    peer_b?: string | null;
  },
  currentUserId: string,
  profiles: Map<string, StaffChatPeer>,
  lastMessage: StaffChatMessage | null,
  lastReadAt: string | null,
): StaffChatConversation {
  const peerId = otherPeerId(row, currentUserId);
  const unread = Boolean(
    lastMessage &&
      lastMessage.sender_id !== currentUserId &&
      (!lastReadAt || lastMessage.created_at > lastReadAt),
  );

  return {
    id: row.id,
    kind: row.kind === "dm" ? "dm" : "group",
    created_at: row.created_at,
    updated_at: row.updated_at,
    peer: peerId ? (profiles.get(peerId) ?? null) : null,
    last_message: lastMessage
      ? attachMessageSender(lastMessage, profiles)
      : null,
    unread,
  };
}

export async function listStaffProfiles(admin: any) {
  return withTimeout(
    admin
      .from("profiles")
      .select(STAFF_PROFILE_SELECT)
      .in("role", ["operator", "admin"]),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
}

export function staffProfilesMap(
  rows: Array<{
    id: string;
    email: string;
    role?: string | null;
    operator_pseudonym?: string | null;
    staff_active?: boolean | null;
  }>,
) {
  const map = new Map<string, StaffChatPeer>();
  for (const row of rows) {
    map.set(row.id, mapStaffPeer(row));
  }
  return map;
}

export async function ensureGroupConversation(admin: any) {
  const existing = await withTimeout(
    admin.from("staff_conversations").select("*").eq("kind", "group").maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
  if (existing.data || existing.error) return existing;

  const inserted = await withTimeout(
    admin
      .from("staff_conversations")
      .insert({ kind: "group" })
      .select("*")
      .single(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
  if (inserted.data) return inserted;

  return withTimeout(
    admin.from("staff_conversations").select("*").eq("kind", "group").maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
}

export async function loadStaffConversation(admin: any, id: string) {
  return withTimeout(
    admin.from("staff_conversations").select("*").eq("id", id).maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
}

export async function loadLatestStaffMessages(
  admin: any,
  conversationIds: string[],
) {
  const unique = [...new Set(conversationIds.filter(Boolean))];
  const map = new Map<string, StaffChatMessage>();
  if (unique.length === 0) return map;

  const results = await Promise.all(
    unique.map((id) =>
      withTimeout(
        admin
          .from("staff_messages")
          .select(MESSAGE_SELECT)
          .eq("conversation_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      ),
    ),
  );

  results.forEach((result, index) => {
    if (result.data) {
      map.set(unique[index], result.data as StaffChatMessage);
    }
  });
  return map;
}

export async function loadStaffReads(
  admin: any,
  userId: string,
  conversationIds: string[],
) {
  const unique = [...new Set(conversationIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await withTimeout(
    admin
      .from("staff_conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("profile_id", userId)
      .in("conversation_id", unique),
    8000,
    { data: [], error: null } as any,
  );

  for (const row of (data ?? []) as Array<{
    conversation_id: string;
    last_read_at: string;
  }>) {
    map.set(row.conversation_id, row.last_read_at);
  }
  return map;
}

export async function attachSendersToMessages(
  admin: any,
  messages: StaffChatMessage[],
) {
  const senderIds = [...new Set(messages.map((message) => message.sender_id))];
  if (senderIds.length === 0) return messages;

  const { data } = await withTimeout(
    admin.from("profiles").select(STAFF_PROFILE_SELECT).in("id", senderIds),
    8000,
    { data: [], error: null } as any,
  );
  const profiles = staffProfilesMap((data ?? []) as StaffChatPeer[]);
  return messages.map((message) => attachMessageSender(message, profiles));
}

export { MESSAGE_SELECT };
