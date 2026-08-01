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
  title: "Aurum Swap — Demo Exchange",
  description: "Демо-площадка обмена валют",
};

type AppRole = "guest" | "user" | "operator" | "admin";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialRole: AppRole = "guest";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    initialRole =
      role === "operator" || role === "admin" || role === "user"
        ? role
        : "user";
  }

  return (
    <html lang="ru" className={`${roboto.variable} h-full antialiased`}>
      <body
        className={`${roboto.className} font-sans min-h-full flex flex-col bg-white text-zinc-900`}
      >
        <Providers initialUser={user} initialRole={initialRole}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
