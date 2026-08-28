import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";

export async function requireStaff() {
  const supabase = await createClient();
  const user = await getUserFast(supabase);
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await withTimeout(
    admin.from("profiles").select("role, operator_pseudonym, staff_active, is_senior_operator").eq("id", user.id).maybeSingle(),
    5000,
    { data: null, error: null } as any,
  );

  if (profile?.role !== "operator" && profile?.role !== "admin") {
    return null;
  }

  return { user, admin, profile };
}

export async function requireAdmin() {
  const staff = await requireStaff();
  if (!staff || staff.profile?.role !== "admin") {
    return null;
  }
  return staff;
}

export async function requireUser() {
  const supabase = await createClient();
  const user = await getUserFast(supabase);
  if (!user) return null;

  const admin = createAdminClient();
  return { user, admin };
}

export function isClientRole(role: string | null | undefined): boolean {
  return role === "user";
}

export async function getProfileRole(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await withTimeout(
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    5000,
    { data: null, error: null } as any,
  );

  return profile?.role ?? null;
}

export async function isClientUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const role = await getProfileRole(admin, userId);
  return isClientRole(role);
}

export async function requireClient() {
  const actor = await requireUser();
  if (!actor) return null;

  const role = await getProfileRole(actor.admin, actor.user.id);
  if (!isClientRole(role)) {
    return null;
  }

  return actor;
}

export async function filterClientConversationRows(
  admin: ReturnType<typeof createAdminClient>,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
  const { data: profiles } = await withTimeout(
    admin.from("profiles").select("id, role").in("id", userIds),
    5000,
    { data: [], error: null } as any,
  );

  const clientIds = new Set(
    (profiles ?? [])
      .filter((profile: { role?: string }) => isClientRole(profile.role))
      .map((profile: { id: string }) => String(profile.id)),
  );

  return rows.filter((row) => clientIds.has(String(row.user_id)));
}

export async function assertClientConversation(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!(await isClientUser(admin, userId))) {
    return { ok: false, error: "Not found", status: 404 };
  }

  return { ok: true };
}
