import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { redirect } from "next/navigation";

import ClientDashboard from "./components/ClientDashboard";

const ACTIVE_STATUSES = [
  "pending",
  "processing",
  "awaiting_payment",
  "paid",
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?auth=required");
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const currentRole = profile?.role || "user";

  if (currentRole === "operator" || currentRole === "admin") {
    redirect("/operator/dashboard");
  }

  const [activeRes, completedRes] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, created_at, status, currency_from, currency_to, amount_from, amount_to",
      )
      .eq("user_id", user.id)
      .in("status", [...ACTIVE_STATUSES])
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
  ]);

  return (
    <ClientDashboard
      userEmail={user.email || "Пользователь"}
      activeOrders={activeRes.data || []}
      completedCount={completedRes.count || 0}
    />
  );
}
