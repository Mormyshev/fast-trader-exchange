import { withTimeout } from "@/src/utils/supabase/with-timeout";

export async function getOrCreateClientConversation(
  admin: { from: (table: string) => any },
  userId: string,
): Promise<
  | { ok: true; row: Record<string, unknown>; created: boolean }
  | { ok: false; error: string }
> {
  const existing = await withTimeout(
    admin
      .from("chat_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );

  if (existing.error) {
    return { ok: false, error: existing.error.message };
  }
  if (existing.data) {
    return { ok: true, row: existing.data as Record<string, unknown>, created: false };
  }

  const created = await withTimeout(
    admin
      .from("chat_conversations")
      .insert({ user_id: userId, status: "open" })
      .select("*")
      .single(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );

  if (created.error || !created.data) {
    return {
      ok: false,
      error: created.error?.message ?? "Не удалось открыть чат поддержки",
    };
  }

  return { ok: true, row: created.data as Record<string, unknown>, created: true };
}
