import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { createClient } from "@/src/utils/supabase/server";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Fast Trader Exchange",
  description: "Надежный обмен валют",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Получаем сессию за 1-2 миллисекунды из куки (без запроса к БД)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="ru" className={`${roboto.variable} h-full antialiased`}>
      <body
        className={`${roboto.className} font-sans min-h-full flex flex-col bg-white text-zinc-900`}
      >
        {/* 
          Передаем роль как "guest" по умолчанию. 
          Если user есть, AuthContext мгновенно дозапросит профиль на клиенте 
          и обновит состояние без блокировки рендеринга страницы.
        */}
        <Providers initialUser={user} initialRole="guest">
          {children}
        </Providers>
      </body>
    </html>
  );
}
