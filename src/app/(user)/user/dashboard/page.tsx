import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { redirect } from "next/navigation";

import ClientDashboard, {
  type ActiveOrder,
} from "./components/ClientDashboard";
import { isOrderNumberColumnMissing } from "@/src/utils/orders/public-number";

const ACTIVE_STATUSES = [
  "pending",
  "processing",
  "awaiting_payment",
  "paid",
] as const;

const ACTIVE_FIELDS =
  "id, created_at, status, currency_from, currency_to, amount_from, amount_to, order_number";
const ACTIVE_FIELDS_FALLBACK =
  "id, created_at, status, currency_from, currency_to, amount_from, amount_to";

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

  const fetchActive = (fields: string) =>
    admin
      .from("orders")
      .select(fields)
      .eq("user_id", user.id)
      .in("status", [...ACTIVE_STATUSES])
      .order("created_at", { ascending: false });

  const [activeRes, completedRes] = await Promise.all([
    fetchActive(ACTIVE_FIELDS),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
  ]);

  let activeOrders: ActiveOrder[] = [];
  if (activeRes.error && isOrderNumberColumnMissing(activeRes.error)) {
    const fallback = await fetchActive(ACTIVE_FIELDS_FALLBACK);
    activeOrders = (fallback.data ?? []) as unknown as ActiveOrder[];
  } else if (!activeRes.error) {
    activeOrders = (activeRes.data ?? []) as unknown as ActiveOrder[];
  }

  return (
    <ClientDashboard
      userEmail={user.email || "Пользователь"}
      activeOrders={activeOrders}
      completedCount={completedRes.count || 0}
    />
  );
}
