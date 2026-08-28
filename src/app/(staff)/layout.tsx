import { createClient } from "@/src/utils/supabase/server";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { redirect } from "next/navigation";
import StaffLayoutClient from "./StaffLayoutClient";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getUserFast(supabase);

  if (!user) {
    redirect("/");
  }

  // role через admin — не зависит от RLS и браузерного REST
  const admin = createAdminClient();
  const { data: profile } = await withTimeout(
    admin
      .from("profiles")
      .select("role, operator_pseudonym, staff_active, is_senior_operator")
      .eq("id", user.id)
      .maybeSingle(),
    5000,
    { data: null, error: null } as any,
  );

  const role = profile?.role || "user";

  if (role !== "operator" && role !== "admin") {
    redirect("/user/orders");
  }

  const operatorPseudonym = profile?.operator_pseudonym?.trim() || null;
  const initialStaffActive = profile?.staff_active === true;
  const initialIsSeniorOperator = profile?.is_senior_operator === true;

  return (
    <StaffLayoutClient
      role={role}
      initialOperatorPseudonym={operatorPseudonym}
      initialStaffActive={initialStaffActive}
      initialIsSeniorOperator={initialIsSeniorOperator}
    >
      {children}
    </StaffLayoutClient>
  );
}
