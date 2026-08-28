export type StaffRoleLike = {
  role?: string | null;
  is_senior_operator?: boolean | null;
};

export function isSeniorOperatorFlag(
  profile: { is_senior_operator?: boolean | null } | null | undefined,
): boolean {
  return profile?.is_senior_operator === true;
}

export function isAdminOrSeniorOperator(
  profile: StaffRoleLike | null | undefined,
): boolean {
  return profile?.role === "admin" || isSeniorOperatorFlag(profile);
}

export function canReassignOrders(
  profile: StaffRoleLike | null | undefined,
): boolean {
  return isAdminOrSeniorOperator(profile);
}

export function canVerifyClients(
  profile: StaffRoleLike | null | undefined,
): boolean {
  return isAdminOrSeniorOperator(profile);
}

export function staffPositionLabel(
  profile: StaffRoleLike | null | undefined,
): string {
  if (profile?.role === "admin") return "Админ";
  if (isSeniorOperatorFlag(profile)) return "Старший оператор";
  return "Оператор";
}

export function staffPositionLabelShort(
  profile: StaffRoleLike | null | undefined,
): string {
  if (profile?.role === "admin") return "админ";
  if (isSeniorOperatorFlag(profile)) return "старший оператор";
  return "оператор";
}
