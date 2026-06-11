// "use client";

// import ExchangeCalculator from "../components/ExchangeCalculator/ExchangeCalculator";
// import Advantages from "./components/HomePage/Advantages/Advantages";
// import Stats from "./components/HomePage/Stats/Stats";

// export default function Home() {
//     return (
//         <main className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-200">
//             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 md:space-y-8">
//                 <ExchangeCalculator />
//                 <Advantages />
//                 <Stats />
//             </div>
//         </main>
//     );
// }
import { createClient } from "@/src/utils/supabase";

export default async function TestPage() {
    let connectionStatus = "Проверка...";
    let errorMessage = "";

    try {
        const supabase = await createClient();

        // Делаем самый простой запрос к служебной функции Supabase,
        // которая возвращает список версий или просто проверяет доступность
        const { data, error } = await supabase
            .from("_any_non_existent_table")
            .select("*")
            .limit(1);

        // Если ошибки сети нет, значит Supabase ответил.
        // Ошибка "PGRST116" или "relation does not exist" — это ОТЛИЧНО,
        // так как это ответ от самой базы данных (база сказала, что таблицы нет, но связь есть!).
        if (
            error &&
            error.code !== "PGRST116" &&
            !error.message.includes("relation")
        ) {
            connectionStatus = "Ошибка подключения ❌";
            errorMessage = error.message;
        } else {
            connectionStatus = "Успешно подключено к Supabase!  ";
        }
    } catch (err: any) {
        connectionStatus = "Критическая ошибка кода ❌";
        errorMessage = err.message || String(err);
    }

    return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
            <h1>Статус подключения:</h1>
            <p style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                {connectionStatus}
            </p>
            {errorMessage && (
                <pre
                    style={{
                        background: "#eee",
                        padding: "1rem",
                        color: "red",
                    }}
                >
                    {errorMessage}
                </pre>
            )}
        </div>
    );
}
