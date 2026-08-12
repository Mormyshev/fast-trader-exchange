import { createAdminClient } from "@/src/utils/supabase/admin";
import {
  SUPPORT_INBOX_CHANNEL,
  CHAT_MESSAGE_CREATED_EVENT,
  CHAT_CONVERSATION_UPDATED_EVENT,
} from "@/src/utils/supabase/support-events";

export {
  SUPPORT_INBOX_CHANNEL,
  CHAT_MESSAGE_CREATED_EVENT,
  CHAT_CONVERSATION_UPDATED_EVENT,
};

export async function broadcastChatMessage(payload: Record<string, unknown>) {
  await broadcastSupportEvent(CHAT_MESSAGE_CREATED_EVENT, payload);
}

export async function broadcastChatConversation(payload: Record<string, unknown>) {
  await broadcastSupportEvent(CHAT_CONVERSATION_UPDATED_EVENT, payload);
}

async function broadcastSupportEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const channel = admin.channel(SUPPORT_INBOX_CHANNEL, {
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

    await channel.send({ type: "broadcast", event, payload });
  } catch (err) {
    console.warn("[broadcast]", event, err);
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch {
      // ignore
    }
  }
}
