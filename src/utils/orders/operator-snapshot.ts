export async function fetchOperatorPseudonym(
  admin: any,
  operatorId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("operator_pseudonym")
    .eq("id", operatorId)
    .maybeSingle();

  const value = data?.operator_pseudonym?.trim();
  return value || null;
}

export function stripOrderInternalFields<T extends Record<string, unknown>>(
  order: T,
): Omit<T, "operator_id" | "operator_pseudonym_snapshot" | "client"> {
  const {
    operator_id: _operatorId,
    operator_pseudonym_snapshot: _snapshot,
    client: _client,
    ...rest
  } = order;
  return rest as Omit<T, "operator_id" | "operator_pseudonym_snapshot" | "client">;
}

export function formatStaffOperatorLabel(
  snapshot: string | null | undefined,
): string | null {
  const value = snapshot?.trim();
  return value || null;
}
