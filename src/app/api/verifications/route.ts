import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";

async function requireStaff() {
  const supabase = await createClient();
  const user = await getUserFast(supabase);
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await withTimeout(
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    5000,
    { data: null, error: null } as any,
  );

  if (profile?.role !== "operator" && profile?.role !== "admin") {
    return null;
  }

  return { user, admin };
}

export async function GET() {
  try {
    const actor = await requireStaff();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .select(
          "id, email, last_name, first_name, middle_name, phone, telegram, passport_url, verification",
        )
        .eq("verification", "on_check"),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireStaff();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const id = String(body.id || "");
    const status = body.status;
    if (!id || (status !== "verified" && status !== "not_started")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .update({
          verification: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? id, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
