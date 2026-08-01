import { createAdminClient } from "@/src/utils/supabase/admin";
import {
  ORDERS_INBOX_CHANNEL,
  ORDER_CREATED_EVENT,
  ORDER_UPDATED_EVENT,
} from "@/src/utils/supabase/orders-events";

export {
  ORDERS_INBOX_CHANNEL,
  ORDER_CREATED_EVENT,
  ORDER_UPDATED_EVENT,
};

/** Push instant notice to operator UIs (does not rely on postgres_changes / RLS). */
export async function broadcastOrderEvent(
  event: typeof ORDER_CREATED_EVENT | typeof ORDER_UPDATED_EVENT,
  order: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const channel = admin.channel(ORDERS_INBOX_CHANNEL, {
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
      event,
      payload: { order },
    });
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
