import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Header from "@/src/components/Header/Header";
import Footer from "@/src/components/Footer/Footer";
import OrderStatusClient from "./OrderStatusClient";
import { expireOrderIfNeeded } from "@/src/utils/orders/expire-orders";
import { stripOrderInternalFields } from "@/src/utils/orders/operator-snapshot";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const admin = createAdminClient();
  const [{ data: order }, { data: profile }] = await Promise.all([
    admin.from("orders").select("*").eq("id", id).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (!order) {
    notFound();
  }

  const isStaff =
    profile?.role === "operator" || profile?.role === "admin";

  // Операторский интерфейс — отдельная страница, не клиентский /order/[id]
  if (isStaff) {
    redirect(`/operator/orders/${id}`);
  }

  if (order.user_id !== user.id) {
    notFound();
  }

  const fresh = await expireOrderIfNeeded(admin, order);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 dark:bg-zinc-950">
      <Header />
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 mb-12 sm:mb-16 mt-4 sm:mt-6 md:mt-8 antialiased">
        <OrderStatusClient
          initialOrder={stripOrderInternalFields(
            fresh as Record<string, unknown>,
          )}
        />
      </main>
      <Footer />
    </div>
  );
}
