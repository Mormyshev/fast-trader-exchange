import Header from "@/src/components/Header/Header";
import Footer from "@/src/components/Footer/Footer";
import { createClient } from "@/src/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/"); // Оставляем только базовую защиту от гостей

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 dark:bg-zinc-950">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 w-full pt-4 sm:pt-6 md:pt-8 pb-10 sm:pb-12 md:pb-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
