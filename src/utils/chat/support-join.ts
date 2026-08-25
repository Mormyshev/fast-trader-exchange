import type { ChatConversation } from "@/src/utils/chat/types";

export type SupportStaffRole = "operator" | "admin";

export function getAssignedStaffRole(
  conversation?: ChatConversation | null,
): SupportStaffRole | null {
  if (!conversation?.operator_id) return null;
  const role =
    conversation.assigned_operator?.role || conversation.operator?.role;
  return role === "admin" ? "admin" : "operator";
}

export function supportStaffTitle(role?: SupportStaffRole | null) {
  return role === "admin" ? "Администратор" : "Техподдержка";
}

export function supportOnlineSubtitle(role?: SupportStaffRole | null) {
  return role === "admin"
    ? "Администратор на связи"
    : "Техподдержка на связи";
}

export function supportJoinedMessage(role?: SupportStaffRole | null) {
  return role === "admin"
    ? "Администратор подключился к чату"
    : "Техподдержка подключилась к чату";
}

export function supportWaitingLabel() {
  return "Ожидайте подключения поддержки";
}
