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
  const name = [client.last_name, client.first_name, client.middle_name]
    .filter(Boolean)
    .join(" ");
  return name || client.email || "—";
}
