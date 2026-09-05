export const CHAT_NICKS = [
  "Алекс",
  "Макс",
  "Игорь",
  "Кирилл",
  "Андрей",
  "Дмитрий",
  "Сергей",
  "Павел",
  "Никита",
  "Роман",
  "Егор",
  "Артём",
] as const;

export type ChatNick = (typeof CHAT_NICKS)[number];

export function isChatNick(value: string | null | undefined): value is ChatNick {
  const trimmed = value?.trim();
  return Boolean(trimmed && (CHAT_NICKS as readonly string[]).includes(trimmed));
}

export function parseChatNick(
  raw: unknown,
  current?: string | null,
): { ok: true; value: ChatNick } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Выберите ник для чата" };
  }
  const trimmed = raw.trim();
  if (current && trimmed === current.trim() && isChatNick(trimmed)) {
    return { ok: true, value: trimmed };
  }
  if (!isChatNick(trimmed)) {
    return { ok: false, error: "Ник для чата нужно выбрать из списка" };
  }
  return { ok: true, value: trimmed };
}

export function publicChatNick(
  live?: string | null,
  snapshot?: string | null,
): string | null {
  if (isChatNick(live)) return live.trim();
  if (isChatNick(snapshot)) return snapshot.trim();
  return null;
}

export async function isChatNickTaken(
  admin: { from: (table: string) => any },
  nick: string,
  exceptId?: string,
): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("id, chat_pseudonym")
    .in("role", ["operator", "admin"]);

  const needle = nick.trim();
  if (!needle) return false;

  return (Array.isArray(data) ? data : []).some((row) => {
    if (exceptId && row.id === exceptId) return false;
    return String(row.chat_pseudonym || "").trim() === needle;
  });
}
