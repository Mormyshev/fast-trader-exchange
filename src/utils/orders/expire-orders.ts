import type { SupabaseClient } from "@supabase/supabase-js";
import {
  broadcastOrderEvent,
  ORDER_UPDATED_EVENT,
} from "@/src/utils/supabase/broadcast";
import {
  isOrderExpiredByTtl,
  ORDER_TTL_MS,
  ORDER_TTL_STATUSES,
} from "@/src/utils/orders/ttl";

type OrderRow = Record<string, unknown> & {
  id: string;
  status: string;
  created_at: string;
};

/** Cancel one order if it outlived the TTL. Returns the (possibly updated) order. */
export async function expireOrderIfNeeded(
  admin: SupabaseClient,
  order: OrderRow,
): Promise<OrderRow> {
  if (!ORDER_TTL_STATUSES.includes(order.status as (typeof ORDER_TTL_STATUSES)[number])) {
    return order;
  }
  if (!isOrderExpiredByTtl(order.created_at)) {
    return order;
  }

  const { data: updated, error } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", order.id)
    .in("status", [...ORDER_TTL_STATUSES])
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    return { ...order, status: "cancelled" };
  }

  void broadcastOrderEvent(ORDER_UPDATED_EVENT, updated as Record<string, unknown>);
  return updated as OrderRow;
}

/** Bulk-cancel all orders past TTL. Safe to call from cron or list endpoints. */
export async function cancelExpiredOrders(admin: SupabaseClient): Promise<{
  cancelled: number;
  ids: string[];
}> {
  const cutoff = new Date(Date.now() - ORDER_TTL_MS).toISOString();

  const { data: expired, error } = await admin
    .from("orders")
    .select("*")
    .in("status", [...ORDER_TTL_STATUSES])
    .lt("created_at", cutoff);

  if (error || !expired?.length) {
    return { cancelled: 0, ids: [] };
  }

  const ids = expired.map((o) => o.id as string);

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .in("id", ids)
    .in("status", [...ORDER_TTL_STATUSES])
    .select("*");

  if (updateError) {
    console.error("[expire-orders]", updateError.message);
    return { cancelled: 0, ids: [] };
  }

  const rows = updated ?? [];
  await Promise.all(
    rows.map((row) =>
      broadcastOrderEvent(ORDER_UPDATED_EVENT, row as Record<string, unknown>),
    ),
  );

  return { cancelled: rows.length, ids: rows.map((r) => r.id as string) };
}
