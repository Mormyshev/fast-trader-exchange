import { createAdminClient } from "@/src/utils/supabase/admin";
import {
  STAFF_CHAT_INBOX_CHANNEL,
  STAFF_CHAT_MESSAGE_CREATED_EVENT,
  STAFF_CHAT_CONVERSATION_UPDATED_EVENT,
} from "@/src/utils/supabase/staff-chat-events";

export async function broadcastStaffChatMessage(
  payload: Record<string, unknown>,
) {
  const message = payload.message as Record<string, unknown> | undefined;
  await broadcastStaffChatEvent(STAFF_CHAT_MESSAGE_CREATED_EVENT, {
    conversationId:
      payload.conversationId ?? message?.conversation_id ?? null,
    messageId: message?.id ?? payload.messageId ?? null,
  });
}

export async function broadcastStaffChatConversation(
  payload: Record<string, unknown>,
) {
  const conversation = payload.conversation as Record<string, unknown> | undefined;
  await broadcastStaffChatEvent(STAFF_CHAT_CONVERSATION_UPDATED_EVENT, {
    conversationId: conversation?.id ?? payload.conversationId ?? null,
  });
}

async function broadcastStaffChatEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const channel = admin.channel(STAFF_CHAT_INBOX_CHANNEL, {
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
