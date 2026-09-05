import { validateOperatorPseudonym } from "@/src/utils/validation";

export const OPERATOR_PROFILE_FIELDS =
  "id, email, role, operator_pseudonym, chat_pseudonym, staff_active, is_senior_operator, updated_at";

export async function isPseudonymTaken(
  admin: { from: (table: string) => any },
  pseudonym: string,
  exceptId?: string,
): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("id, operator_pseudonym")
    .in("role", ["operator", "admin"]);

  const needle = pseudonym.trim().toLocaleLowerCase("ru");
  if (!needle) return false;

  return (Array.isArray(data) ? data : []).some((row) => {
    if (exceptId && row.id === exceptId) return false;
    const current = String(row.operator_pseudonym || "")
      .trim()
      .toLocaleLowerCase("ru");
    return current === needle;
  });
}

export function parseAssignedPseudonym(
  raw: unknown,
  current?: string | null,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Укажите ник оператора" };
  }
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (current && trimmed.toLocaleLowerCase("ru") === current.trim().toLocaleLowerCase("ru")) {
    return { ok: true, value: current.trim() };
  }
  return validateOperatorPseudonym(trimmed);
}
