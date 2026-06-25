import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
          } catch (error) {}
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  let initialRole: "guest" | "user" | "operator" | "admin" = "guest";

  if (session?.user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    // Синхронизируем тип роли с вашей структурой БД: operator вместо manager
    initialRole = (data?.role as any) || "user";
  }

  return (
    <html lang="ru" className="h-full antialiased">
      <body
        className={`${roboto.className} font-sans min-h-full flex flex-col bg-white text-zinc-900`}
      >
        <Providers
          initialUser={session?.user || null}
          initialRole={initialRole}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
