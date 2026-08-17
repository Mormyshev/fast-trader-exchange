"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  ORDERS_INBOX_CHANNEL,
  ORDER_CREATED_EVENT,
  ORDER_UPDATED_EVENT,
} from "@/src/utils/supabase/orders-events";

type OrderHandler = (order: any, event: "created" | "updated") => void;

const listeners = new Set<OrderHandler>();
let channel: RealtimeChannel | null = null;
let client: SupabaseClient | null = null;

function fanout(order: unknown, event: "created" | "updated") {
  if (!order) return;
  listeners.forEach((handler) => handler(order, event));
}

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
    .channel(ORDERS_INBOX_CHANNEL)
    .on("broadcast", { event: ORDER_CREATED_EVENT }, ({ payload }) => {
      fanout(payload?.order, "created");
    })
    .on("broadcast", { event: ORDER_UPDATED_EVENT }, ({ payload }) => {
      fanout(payload?.order, "updated");
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[realtime]", ORDERS_INBOX_CHANNEL, status);
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

/** Instant operator inbox via Realtime Broadcast (works even when postgres_changes is broken). */
export function subscribeOrdersInbox(
  supabase: SupabaseClient,
  onOrder: OrderHandler,
): { unsubscribe: () => void } {
  listeners.add(onOrder);
  ensureChannel(supabase);

  return {
    unsubscribe() {
      listeners.delete(onOrder);
      if (listeners.size === 0 && channel && client) {
        void client.removeChannel(channel);
        channel = null;
        client = null;
      }
    },
  };
}
