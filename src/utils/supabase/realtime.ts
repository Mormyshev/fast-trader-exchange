import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type StatusHandler = (status: string) => void;

/**
 * Ensure JWT is on the Realtime socket, then subscribe.
 * Without a session, RLS-backed postgres_changes events are silently dropped.
 */
export async function subscribeWithAuth(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
  onStatus?: StatusHandler,
): Promise<RealtimeChannel> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    await supabase.realtime.setAuth(token);
  }

  return channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("[realtime]", channel.topic, status);
    }
    onStatus?.(status);
  });
}

/** Slow BFF poll so the UI still updates if the WebSocket never SUBSCRIBES. */
export function startPolling(fn: () => void, intervalMs = 5000): () => void {
  const id = setInterval(fn, intervalMs);
  return () => clearInterval(id);
}
