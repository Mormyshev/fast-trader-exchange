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

export function staffRoleInitial(
  profile?: StaffRoleLike | null,
  tone?: AvatarTone,
): string {
  if (profile?.role === "admin" || tone === "admin") return "А";
  if (isSeniorOperatorFlag(profile) || tone === "senior") return "С";
  return "О";
}

export function staffPositionLabelShort(
  profile: StaffRoleLike | null | undefined,
): string {
  if (profile?.role === "admin") return "админ";
  if (isSeniorOperatorFlag(profile)) return "старший оператор";
  return "оператор";
}

export type AvatarTone = "admin" | "senior" | "operator" | "client";

export function avatarToneFromProfile(
  profile: StaffRoleLike | null | undefined,
): AvatarTone {
  if (profile?.role === "admin") return "admin";
  if (isSeniorOperatorFlag(profile)) return "senior";
  return "operator";
}

export function avatarToneClass(tone: AvatarTone): string {
  switch (tone) {
    case "admin":
      return "bg-violet-600 text-white border-violet-500";
    case "senior":
      return "bg-sky-500 text-white border-sky-400";
    case "operator":
      return "bg-[#FFDD2D] text-zinc-900 border-amber-200/80";
    case "client":
      return "bg-teal-100 text-teal-800 border-teal-200";
  }
}
