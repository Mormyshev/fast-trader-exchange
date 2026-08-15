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
): Omit<T, "operator_pseudonym_snapshot"> {
  const { operator_pseudonym_snapshot: _snapshot, ...rest } = order;
  return rest as Omit<T, "operator_pseudonym_snapshot">;
}

export function formatStaffOperatorLabel(
  snapshot: string | null | undefined,
): string | null {
  const value = snapshot?.trim();
  return value || null;
}
