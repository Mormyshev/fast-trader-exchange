import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isOperator = profile?.role === "operator";
  const isAdmin = profile?.role === "admin";

  if (!isOperator && !isAdmin) {
    redirect("/user/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <aside className="w-64 bg-zinc-900 text-white p-6 flex flex-col justify-between border-r border-zinc-800">
        <div className="space-y-6">
          <div className="font-bold text-lg border-b border-zinc-800 pb-3">
            Панель {isAdmin ? "Администратора" : "Оператора"}
          </div>

          <nav className="flex flex-col space-y-2">
            <Link
              href="/operator/dashboard"
              className="hover:bg-zinc-800 p-2.5 rounded-xl block text-sm transition-colors"
            >
              Дашборд статистики
            </Link>
            <Link
              href="/operator/verification"
              className="hover:bg-zinc-800 p-2.5 rounded-xl block text-sm transition-colors"
            >
              Проверка анкет
            </Link>

            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block pl-2 mb-1">
                  Администрирование
                </span>
                <Link
                  href="/admin/manage-operators"
                  className="hover:bg-zinc-800 p-2.5 rounded-xl block text-sm text-amber-400 transition-colors"
                >
                  Управление персоналом
                </Link>
                <Link
                  href="/admin/settings"
                  className="hover:bg-zinc-800 p-2.5 rounded-xl block text-sm text-amber-400 transition-colors"
                >
                  Настройки системы
                </Link>
              </div>
            )}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
