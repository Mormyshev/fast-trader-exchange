import type { ChatConversation } from "@/src/utils/chat/types";
import { assertClientConversation } from "@/src/utils/chat/auth";

export function getStaffPseudonym(
  profile: { operator_pseudonym?: string | null } | null | undefined,
): string | null {
  const value = profile?.operator_pseudonym?.trim();
  return value || null;
}

export const STAFF_PSEUDONYM_REQUIRED =
  "Псевдоним ещё не назначен. Обратитесь к администратору.";

export function buildOperatorMeta(
  row: Record<string, unknown>,
  operatorProfile?: Record<string, unknown> | null,
): ChatConversation["operator"] {
  if (!row.operator_id) return null;

  const snapshot =
    typeof row.operator_pseudonym_snapshot === "string"
      ? row.operator_pseudonym_snapshot.trim()
      : "";

  const live =
    typeof operatorProfile?.operator_pseudonym === "string"
      ? operatorProfile.operator_pseudonym.trim()
      : "";

  return {
    operator_pseudonym: live || snapshot || null,
    role: operatorProfile?.role === "admin" ? "admin" : "operator",
  };
}

export function buildAssignedOperatorMeta(
  row: Record<string, unknown>,
  operatorProfile?: Record<string, unknown> | null,
): ChatConversation["assigned_operator"] {
  if (!row.operator_id) return null;

  const pseudonym =
    typeof operatorProfile?.operator_pseudonym === "string"
      ? operatorProfile.operator_pseudonym.trim()
      : "";

  return {
    id: String(row.operator_id),
    operator_pseudonym: pseudonym || null,
    role: operatorProfile?.role === "admin" ? "admin" : "operator",
  };
}

type StaffConversationResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string; status: number };

async function loadStaffConversation(
  admin: any,
  conversationId: string,
): Promise<StaffConversationResult> {
  const { data: row, error } = await admin
    .from("chat_conversations")
    .select("id, operator_id, operator_pseudonym_snapshot, status, user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 503 };
  }
  if (!row || row.status !== "open") {
    return { ok: false, error: "Not found", status: 404 };
  }

  const clientCheck = await assertClientConversation(
    admin,
    String(row.user_id),
  );
  if (!clientCheck.ok) {
    return clientCheck;
  }

  return { ok: true, row };
}

export async function claimConversation(
  admin: any,
  conversationId: string,
  staffUserId: string,
  pseudonym: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const loaded = await loadStaffConversation(admin, conversationId);
  if (!loaded.ok) return loaded;

  const { row } = loaded;

  if (row.operator_id === staffUserId) {
    if (!row.operator_pseudonym_snapshot) {
      await admin
        .from("chat_conversations")
        .update({ operator_pseudonym_snapshot: pseudonym })
        .eq("id", conversationId)
        .eq("operator_id", staffUserId)
        .is("operator_pseudonym_snapshot", null);
    }
    return { ok: true };
  }

  if (row.operator_id) {
    return {
      ok: false,
      error: "Чат уже в работе у другого оператора",
      status: 409,
    };
  }

  const { data: claimed } = await admin
    .from("chat_conversations")
    .update({
      operator_id: staffUserId,
      operator_pseudonym_snapshot: pseudonym,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .is("operator_id", null)
    .select("id, operator_id")
    .maybeSingle();

  if (!claimed) {
    const refreshed = await loadStaffConversation(admin, conversationId);
    if (!refreshed.ok) return refreshed;

    if (refreshed.row.operator_id === staffUserId) {
      return { ok: true };
    }

    return {
      ok: false,
      error: "Чат уже в работе у другого оператора",
      status: 409,
    };
  }

  return { ok: true };
}

export async function takeoverConversation(
  admin: any,
  conversationId: string,
  staffUserId: string,
  pseudonym: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const loaded = await loadStaffConversation(admin, conversationId);
  if (!loaded.ok) return loaded;

  const { row } = loaded;

  if (!row.operator_id) {
    return {
      ok: false,
      error: "Сначала возьмите чат в работу",
      status: 409,
    };
  }

  if (row.operator_id === staffUserId) {
    if (row.operator_pseudonym_snapshot !== pseudonym) {
      await admin
        .from("chat_conversations")
        .update({ operator_pseudonym_snapshot: pseudonym })
        .eq("id", conversationId)
        .eq("operator_id", staffUserId);
    }
    return { ok: true };
  }

  const previousOperatorId = row.operator_id;

  const { data: updated } = await admin
    .from("chat_conversations")
    .update({
      operator_id: staffUserId,
      operator_pseudonym_snapshot: pseudonym,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("operator_id", previousOperatorId)
    .select("id, operator_id")
    .maybeSingle();

  if (!updated) {
    const refreshed = await loadStaffConversation(admin, conversationId);
    if (!refreshed.ok) return refreshed;

    if (refreshed.row.operator_id === staffUserId) {
      return { ok: true };
    }

    return {
      ok: false,
      error: "Не удалось перехватить диалог",
      status: 409,
    };
  }

  return { ok: true };
}

export async function ensureStaffCanReply(
  admin: any,
  conversationId: string,
  staffUserId: string,
  pseudonym: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const loaded = await loadStaffConversation(admin, conversationId);
  if (!loaded.ok) return loaded;

  const { row } = loaded;

  if (row.operator_id && row.operator_id !== staffUserId) {
    return {
      ok: false,
      error: "Сначала возьмите диалог на себя",
      status: 403,
    };
  }

  if (!row.operator_id) {
    return claimConversation(admin, conversationId, staffUserId, pseudonym);
  }

  if (!row.operator_pseudonym_snapshot) {
    await admin
      .from("chat_conversations")
      .update({ operator_pseudonym_snapshot: pseudonym })
      .eq("id", conversationId)
      .eq("operator_id", staffUserId)
      .is("operator_pseudonym_snapshot", null);
  }

  return { ok: true };
}
