import { createClient } from "@/src/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const supabase = await createClient();

    // Получаем сессию на сервере (это быстро и безопасно)
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    // Если сессии нет — жесткий редирект на главную
    if (error || !user) {
        redirect("/?auth=required");
    }

    // Запрашиваем роль
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    return (
        <div className="mx-auto max-w-7xl p-8">
            <h1 className="text-2xl font-bold">
                Добро пожаловать в Личный Кабинет!
            </h1>
            <p className="text-zinc-600 mt-2">Ваш Email: {user.email}</p>
            <p className="text-zinc-600">
                Ваша роль:{" "}
                <span className="font-bold uppercase">{profile?.role}</span>
            </p>

            {/* Менеджерский или админский блок */}
            {(profile?.role === "admin" || profile?.role === "manager") && (
                <div className="mt-6 p-4 border border-amber-200 bg-amber-50 rounded-2xl">
                    <h2 className="font-bold text-amber-800">
                        Панель управления обменами
                    </h2>
                    <p className="text-sm text-amber-700 mt-1">
                        Вам доступны расширенные действия с заявками.
                    </p>
                </div>
            )}
        </div>
    );
}
