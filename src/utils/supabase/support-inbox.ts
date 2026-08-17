"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  SUPPORT_INBOX_CHANNEL,
  CHAT_MESSAGE_CREATED_EVENT,
  CHAT_CONVERSATION_UPDATED_EVENT,
} from "@/src/utils/supabase/support-events";

type MessageHandler = (payload: Record<string, unknown>) => void;
type ConversationHandler = (payload: Record<string, unknown>) => void;

type Listener = {
  onMessage?: MessageHandler;
  onConversation?: ConversationHandler;
};

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;
let client: SupabaseClient | null = null;

function channelIsLive(ch: RealtimeChannel | null) {
  if (!ch) return false;
  const state = (ch as RealtimeChannel & { state?: string }).state;
  return state === "joined" || state === "joining" || state === undefined;
}

function ensureChannel(supabase: SupabaseClient) {
  if (channelIsLive(channel)) return;

  if (channel && client) {
    void client.removeChannel(channel);
  }

  client = supabase;
  channel = supabase
    .channel(SUPPORT_INBOX_CHANNEL)
    .on(
      "broadcast",
      { event: CHAT_MESSAGE_CREATED_EVENT },
      ({ payload }) => {
        if (!payload) return;
        listeners.forEach((listener) =>
          listener.onMessage?.(payload as Record<string, unknown>),
        );
      },
    )
    .on(
      "broadcast",
      { event: CHAT_CONVERSATION_UPDATED_EVENT },
      ({ payload }) => {
        if (!payload) return;
        listeners.forEach((listener) =>
          listener.onConversation?.(payload as Record<string, unknown>),
        );
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[realtime]", SUPPORT_INBOX_CHANNEL, status);
        const supabase = client;
        if (channel && client) {
          void client.removeChannel(channel);
        }
        channel = null;
        client = null;
        if (listeners.size > 0 && supabase) {
          window.setTimeout(() => ensureChannel(supabase), 1000);
        }
      }
    });
}

/**
 * One shared `support-inbox` channel per browser tab.
 * Duplicate `.channel(sameName)` joins break Realtime for the whole socket.
 */
export function subscribeSupportInbox(
  supabase: SupabaseClient,
  handlers: Listener,
): { unsubscribe: () => void } {
  listeners.add(handlers);
  ensureChannel(supabase);

  return {
    unsubscribe() {
      listeners.delete(handlers);
      if (listeners.size === 0 && channel && client) {
        void client.removeChannel(channel);
        channel = null;
        client = null;
      }
    },
  };
}
