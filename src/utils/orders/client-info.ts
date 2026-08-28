export type OrderClient = {
  email: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  phone: string | null;
  telegram: string | null;
};

export function formatClientName(client: OrderClient | null | undefined): string {
  if (!client) return "—";
  return formatVerifiedFio(client) || client.email || "—";
}

export function formatVerifiedFio(profile: {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
}): string {
  return [profile.last_name, profile.first_name, profile.middle_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

export function mergeOrderClient<T extends { id: string; client?: OrderClient | null }>(
  cache: Map<string, OrderClient>,
  order: T,
): T & { client: OrderClient | null } {
  if (order.client) cache.set(order.id, order.client);
  return {
    ...order,
    client: order.client ?? cache.get(order.id) ?? null,
  };
}
