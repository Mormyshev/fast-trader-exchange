import { withTimeout } from "@/src/utils/supabase/with-timeout";

export function operatorLabelFromProfile(
  profile:
    | { operator_pseudonym?: string | null; email?: string | null }
    | null
    | undefined,
): string | null {
  const nick = profile?.operator_pseudonym?.trim();
  if (nick) return nick;
  const email = profile?.email?.trim();
  if (email) return email;
  return null;
}

export async function fetchOperatorPseudonym(
  admin: any,
  operatorId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("operator_pseudonym, email")
    .eq("id", operatorId)
    .maybeSingle();

  return operatorLabelFromProfile(data);
}

function snapshotValue(order: Record<string, unknown>): string | null {
  const value = order.operator_pseudonym_snapshot;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function orderOperatorId(order: Record<string, unknown>): string | null {
  return typeof order.operator_id === "string" && order.operator_id
    ? order.operator_id
    : null;
}

/** Fill missing operator names from profiles so cancelled/closed orders still show who led the deal. */
export async function attachOperatorSnapshots<T extends Record<string, unknown>>(
  admin: any,
  orders: T[],
): Promise<T[]> {
  if (!orders.length) return orders;

  const missingIds = [
    ...new Set(
      orders
        .filter((order) => orderOperatorId(order) && !snapshotValue(order))
        .map((order) => orderOperatorId(order)!),
    ),
  ];

  if (!missingIds.length) return orders;

  const { data: profiles } = await withTimeout(
    admin
      .from("profiles")
      .select("id, operator_pseudonym, email")
      .in("id", missingIds),
    8000,
    { data: [], error: null } as any,
  );

  const byId = new Map<string, string>();
  for (const row of profiles ?? []) {
    const name = operatorLabelFromProfile(row as Record<string, unknown>);
    if (name) byId.set(String((row as { id: string }).id), name);
  }

  const filled = orders.map((order) => {
    if (snapshotValue(order)) return order;
    const operatorId = orderOperatorId(order);
    if (!operatorId) return order;
    const name = byId.get(operatorId) || "Сотрудник";
    return { ...order, operator_pseudonym_snapshot: name };
  });

  const toPersist = filled.filter((order, index) => {
    const name = snapshotValue(order);
    const previous = snapshotValue(orders[index] as Record<string, unknown>);
    return Boolean(name && !previous && name !== "Сотрудник");
  });

  if (toPersist.length) {
    void Promise.all(
      toPersist.map((order) =>
        admin
          .from("orders")
          .update({
            operator_pseudonym_snapshot: snapshotValue(
              order as Record<string, unknown>,
            ),
          })
          .eq("id", order.id)
          .is("operator_pseudonym_snapshot", null),
      ),
    );
  }

  return filled;
}

export async function attachOperatorSnapshot<T extends Record<string, unknown>>(
  admin: any,
  order: T,
): Promise<T> {
  const [enriched] = await attachOperatorSnapshots(admin, [order]);
  return enriched;
}

export function stripOrderInternalFields<T extends Record<string, unknown>>(
  order: T,
): Omit<
  T,
  | "operator_id"
  | "operator_pseudonym_snapshot"
  | "client"
  | "operator_receipt_url"
> {
  const {
    operator_id: _operatorId,
    operator_pseudonym_snapshot: _snapshot,
    client: _client,
    operator_receipt_url: _operatorReceipt,
    ...rest
  } = order;
  return rest as Omit<
    T,
    | "operator_id"
    | "operator_pseudonym_snapshot"
    | "client"
    | "operator_receipt_url"
  >;
}

export function formatStaffOperatorLabel(
  snapshot: string | null | undefined,
): string | null {
  const value = snapshot?.trim();
  return value || null;
}
