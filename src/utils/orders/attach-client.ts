import { withTimeout } from "@/src/utils/supabase/with-timeout";
import type { OrderClient } from "@/src/utils/orders/client-info";

const CLIENT_FIELDS =
  "id, email, last_name, first_name, middle_name, phone, telegram";

function toClient(row: Record<string, unknown> | undefined): OrderClient | null {
  if (!row) return null;
  return {
    email: typeof row.email === "string" ? row.email : null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    first_name: typeof row.first_name === "string" ? row.first_name : null,
    middle_name: typeof row.middle_name === "string" ? row.middle_name : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    telegram: typeof row.telegram === "string" ? row.telegram : null,
  };
}

function orderUserId(order: Record<string, unknown>): string | null {
  return typeof order.user_id === "string" ? order.user_id : null;
}

export async function attachClientsToOrders<T extends Record<string, unknown>>(
  admin: any,
  orders: T[],
): Promise<(T & { client: OrderClient | null })[]> {
  if (!orders.length) return [];

  const ids = [
    ...new Set(
      orders
        .map((order) => orderUserId(order))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (!ids.length) {
    return orders.map((order) => ({ ...order, client: null }));
  }

  const { data: profiles } = await withTimeout(
    admin.from("profiles").select(CLIENT_FIELDS).in("id", ids),
    8000,
    { data: [], error: null } as any,
  );

  const byId = new Map<string, Record<string, unknown>>(
    (profiles ?? []).map((profile: Record<string, unknown>) => [
      String(profile.id),
      profile,
    ]),
  );

  return orders.map((order) => ({
    ...order,
    client: toClient(orderUserId(order) ? byId.get(orderUserId(order)!) : undefined),
  }));
}

export async function attachClientToOrder<T extends Record<string, unknown>>(
  admin: any,
  order: T,
): Promise<T & { client: OrderClient | null }> {
  const [enriched] = await attachClientsToOrders(admin, [order]);
  return enriched;
}
