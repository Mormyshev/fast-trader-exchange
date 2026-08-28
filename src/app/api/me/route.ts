import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { canReassignOrders } from "@/src/utils/staff/permissions";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) {
      return NextResponse.json({ user: null, role: "guest" });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, staff_active, is_senior_operator")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      role: profile?.role || "user",
      staffActive: profile?.staff_active === true,
      isSeniorOperator: profile?.is_senior_operator === true,
      canReassignOrders: canReassignOrders(profile),
    });
  } catch {
    return NextResponse.json({ user: null, role: "guest" });
  }
}
