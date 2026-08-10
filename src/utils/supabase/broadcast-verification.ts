import { createAdminClient } from "@/src/utils/supabase/admin";
import {
  VERIFICATIONS_INBOX_CHANNEL,
  VERIFICATION_UPDATED_EVENT,
} from "@/src/utils/supabase/verification-events";

export {
  VERIFICATIONS_INBOX_CHANNEL,
  VERIFICATION_UPDATED_EVENT,
};

/** Push verification queue updates to operator UIs (does not rely on postgres_changes). */
export async function broadcastVerificationEvent(
  profile: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const channel = admin.channel(VERIFICATIONS_INBOX_CHANNEL, {
    config: { broadcast: { ack: false } },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("broadcast timeout")),
        4000,
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(status));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event: VERIFICATION_UPDATED_EVENT,
      payload: { profile },
    });
  } catch (err) {
    console.warn("[broadcast]", VERIFICATION_UPDATED_EVENT, err);
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch {
      // ignore
    }
  }
}
