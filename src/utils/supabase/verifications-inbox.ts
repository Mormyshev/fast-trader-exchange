"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  VERIFICATIONS_INBOX_CHANNEL,
  VERIFICATION_UPDATED_EVENT,
} from "@/src/utils/supabase/verification-events";

type ProfileHandler = (profile: Record<string, unknown>) => void;

/** Instant operator verification inbox via Realtime Broadcast. */
export function subscribeVerificationsInbox(
  supabase: SupabaseClient,
  onProfile: ProfileHandler,
): RealtimeChannel {
  const channel = supabase
    .channel(VERIFICATIONS_INBOX_CHANNEL)
    .on("broadcast", { event: VERIFICATION_UPDATED_EVENT }, ({ payload }) => {
      if (payload?.profile) onProfile(payload.profile);
    })
    .subscribe();

  return channel;
}
