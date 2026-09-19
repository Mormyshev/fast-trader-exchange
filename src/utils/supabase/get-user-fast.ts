import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withTimeout } from "@/src/utils/supabase/with-timeout";

/**
 * Resolve the current user via Auth server (JWT), not the unverified cookie session.
 */
export async function getUserFast(
  supabase: SupabaseClient,
  timeoutMs = 2500,
): Promise<User | null> {
  try {
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
