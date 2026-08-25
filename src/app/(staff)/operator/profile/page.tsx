import { redirect } from "next/navigation";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";

export default async function OperatorProfileRedirect() {
  const supabase = await createClient();
  const user = await getUserFast(supabase);
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    redirect("/admin/profile");
  }

  redirect("/operator/dashboard");
}
