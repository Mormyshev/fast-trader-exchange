"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  SUPPORT_INBOX_CHANNEL,
  CHAT_MESSAGE_CREATED_EVENT,
  CHAT_CONVERSATION_UPDATED_EVENT,
} from "@/src/utils/supabase/support-events";

type MessageHandler = (payload: Record<string, unknown>) => void;
type ConversationHandler = (payload: Record<string, unknown>) => void;

export function subscribeSupportInbox(
  supabase: SupabaseClient,
  handlers: {
    onMessage?: MessageHandler;
    onConversation?: ConversationHandler;
  },
): RealtimeChannel {
  const channel = supabase.channel(SUPPORT_INBOX_CHANNEL);

  if (handlers.onMessage) {
    channel.on(
      "broadcast",
      { event: CHAT_MESSAGE_CREATED_EVENT },
      ({ payload }) => {
        if (payload) handlers.onMessage?.(payload as Record<string, unknown>);
      },
    );
  }

  if (handlers.onConversation) {
    channel.on(
      "broadcast",
      { event: CHAT_CONVERSATION_UPDATED_EVENT },
      ({ payload }) => {
        if (payload)
          handlers.onConversation?.(payload as Record<string, unknown>);
      },
    );
  }

  channel.subscribe();
  return channel;
}
