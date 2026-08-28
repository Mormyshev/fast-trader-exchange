import { OPERATOR_PSEUDONYMS } from "@/src/utils/staff/pseudonyms";
import { validateOperatorPseudonym } from "@/src/utils/validation";

export const OPERATOR_PROFILE_FIELDS =
  "id, email, role, operator_pseudonym, staff_active, is_senior_operator, updated_at";

export async function isPseudonymTaken(
  admin: { from: (table: string) => any },
  pseudonym: string,
  exceptId?: string,
): Promise<boolean> {
  let query = admin
    .from("profiles")
    .select("id")
    .eq("operator_pseudonym", pseudonym)
    .in("role", ["operator", "admin"]);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data } = await query.limit(1);
  return Array.isArray(data) && data.length > 0;
}

export function parseAssignedPseudonym(
  raw: unknown,
  current?: string | null,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Выберите псевдоним" };
  }
  const trimmed = raw.trim();
  if (current && trimmed === current.trim()) {
    return { ok: true, value: current.trim() };
  }
  return validateOperatorPseudonym(trimmed);
}

export function availablePseudonyms(
  taken: Array<string | null | undefined>,
  keep?: string | null,
): string[] {
  const used = new Set(
    taken
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const keepValue = keep?.trim() || null;
  return OPERATOR_PSEUDONYMS.filter(
    (name) => !used.has(name) || name === keepValue,
  );
}
