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

/** Start a slow BFF poll only while Realtime is not SUBSCRIBED. */
export function bindRealtimeFallback(
  onStatus: (status: string) => void,
  refresh: () => void,
  intervalMs = 15000,
): {
  onStatus: (status: string) => void;
  clear: () => void;
} {
  let timer: ReturnType<typeof setInterval> | null = null;

  const handle = (status: string) => {
    onStatus(status);
    if (status === "SUBSCRIBED") {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      return;
    }
    if (
      (status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED") &&
      !timer
    ) {
      timer = setInterval(refresh, intervalMs);
    }
  };

  return {
    onStatus: handle,
    clear: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
