import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Features from "../components/Features/Features";

// Импортируем серверный клиент Supabase
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fast Trader Exchange",
  description: "Надежный ... ",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 1. Создаем серверный клиент прямо в лейауте с безопасным перебором кук
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (error) {
            // Гасим ошибку Next.js. Изменение кук произойдет в Middleware
          }
        },
      },
    },
  );
  // 2. Получаем пользователя и его роль на сервере
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let initialRole: "guest" | "user" | "manager" | "admin" = "guest";

  if (session?.user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    initialRole = (data?.role as any) || "user";
  }

  return (
    <html lang="ru" className="h-full antialiased">
      <body
        className={`${roboto.className} min-h-full flex flex-col bg-white text-zinc-900`}
      >
        {/* Передаем серверные данные в провайдеры */}
        <Providers
          initialUser={session?.user || null}
          initialRole={initialRole}
        >
          <Header />
          <main className="main-content flex-grow w-full bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-6 bg-transparent">
              <Features />
            </div>
            <div
              className="smooth-scroll-container h-full bg-transparent"
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
            >
              {children}
            </div>
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
