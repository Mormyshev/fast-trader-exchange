import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getUserFast(supabase);

  if (!user) {
    redirect("/");
  }

  const admin = createAdminClient();
  const { data: profile } = await withTimeout(
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    5000,
    { data: null, error: null } as any,
  );

  if (profile?.role !== "admin") {
    redirect("/operator/dashboard");
  }

  return children;
}
