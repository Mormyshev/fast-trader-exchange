import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Header from "@/src/components/Header/Header";
import Footer from "@/src/components/Footer/Footer";
import OrderStatusClient from "./OrderStatusClient";

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

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mb-16 mt-8 antialiased">
        <OrderStatusClient initialOrder={order} />
      </main>
      <Footer />
    </div>
  );
}
