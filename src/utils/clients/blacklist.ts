export const CLIENT_BLACKLISTED_CODE = "CLIENT_BLACKLISTED";

export function formatClientBlacklistMessage(
  reason: string | null | undefined,
): string {
  const text = reason?.trim() || "не указана";
  return `Вас добавили в черный список по причине: ${text}`;
}

export function parseBlacklistReason(value: unknown): {
  ok: true;
  value: string;
} | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "Укажите причину" };
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { ok: false, error: "Укажите причину" };
  }
  if (trimmed.length < 4) {
    return { ok: false, error: "Причина: минимум 4 символа" };
  }
  if (trimmed.length > 1000) {
    return { ok: false, error: "Причина: максимум 1000 символов" };
  }
  return { ok: true, value: trimmed };
}

export function isProfileBlacklisted(
  profile: { is_blacklisted?: boolean | null } | null | undefined,
): boolean {
  return profile?.is_blacklisted === true;
}

export function isBlacklistColumnMissing(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return (
    /is_blacklisted|blacklist_reason|blacklisted_at|blacklisted_by/i.test(
      message,
    ) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message))
  );
}
