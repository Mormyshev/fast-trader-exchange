import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type StatusHandler = (status: string) => void;

/**
 * Ensure JWT is on the client, then subscribe.
 * Without a session, RLS-backed postgres_changes events are silently dropped.
 */
export async function subscribeWithAuth(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
  onStatus?: StatusHandler,
): Promise<RealtimeChannel> {
  await supabase.auth.getSession();

  return channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("[realtime]", channel.topic, status);
    }
    onStatus?.(status);
  });
}
