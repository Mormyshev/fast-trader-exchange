import Header from "@/src/components/Header/Header";
import Footer from "@/src/components/Footer/Footer";
import UserCabinetNav from "@/src/components/UserCabinetNav/UserCabinetNav";
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
  if (!user) redirect("/?auth=required");

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-zinc-950">
      <Header />
      <main className="flex-grow mx-auto w-full max-w-7xl px-4 sm:px-5 md:px-6 lg:px-8 pt-5 sm:pt-6 md:pt-8 pb-10 sm:pb-12 md:pb-16">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-6">
          <UserCabinetNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
