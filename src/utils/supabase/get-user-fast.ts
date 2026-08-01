import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withTimeout } from "@/src/utils/supabase/with-timeout";

/**
 * Resolve the current user without hanging on Supabase Auth outages.
 * Cookie session first (local JWT), then short getUser() fallback.
 */
export async function getUserFast(
  supabase: SupabaseClient,
  timeoutMs = 2500,
): Promise<User | null> {
  try {
    const {
      data: { session },
    } = await withTimeout(supabase.auth.getSession(), timeoutMs, {
      data: { session: null },
      error: null,
    } as any);

    if (session?.user) return session.user;

    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), timeoutMs, {
      data: { user: null },
      error: null,
    } as any);

    return user ?? null;
  } catch {
    return null;
  }
}
