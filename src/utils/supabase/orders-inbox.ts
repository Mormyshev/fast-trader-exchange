"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  ORDERS_INBOX_CHANNEL,
  ORDER_CREATED_EVENT,
  ORDER_UPDATED_EVENT,
} from "@/src/utils/supabase/orders-events";

type OrderHandler = (order: any, event: "created" | "updated") => void;

/** Instant operator inbox via Realtime Broadcast (works even when postgres_changes is broken). */
export function subscribeOrdersInbox(
  supabase: SupabaseClient,
  onOrder: OrderHandler,
): RealtimeChannel {
  // То же имя канала, что и на сервере в broadcastOrderEvent
  const channel = supabase
    .channel(ORDERS_INBOX_CHANNEL)
    .on("broadcast", { event: ORDER_CREATED_EVENT }, ({ payload }) => {
      if (payload?.order) onOrder(payload.order, "created");
    })
    .on("broadcast", { event: ORDER_UPDATED_EVENT }, ({ payload }) => {
      if (payload?.order) onOrder(payload.order, "updated");
    })
    .subscribe();

  return channel;
}
