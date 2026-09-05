import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";
import "./staff-theme.css";
import { createClient } from "@/src/utils/supabase/server";

const AUTH_CALLBACK_BOOTSTRAP = `(function(){try{var p=location.pathname;if(p==="/auth/callback"||p==="/auth/confirm")return;var s=location.search;if(s.indexOf("code=")<0&&s.indexOf("token_hash=")<0)return;var u=new URL("/auth/callback"+s,location.origin);if(!u.searchParams.get("next")&&(p.indexOf("/auth/reset-password")===0||u.searchParams.get("type")==="recovery"))u.searchParams.set("next","/auth/reset-password");location.replace(u.pathname+u.search);}catch(e){}})();`;

const STAFF_THEME_BOOTSTRAP = `(function(){try{var p=location.pathname;if(p.indexOf("/operator")!==0&&p.indexOf("/admin")!==0)return;var m=document.cookie.match(/(?:^|; )fte-staff-theme=([^;]*)/);var d=m&&m[1]==="dark";document.documentElement.classList.toggle("dark",!!d);document.documentElement.classList.toggle("staff-dark",!!d);}catch(e){}})();`;

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
        <Script id="auth-callback-bootstrap" strategy="beforeInteractive">
          {AUTH_CALLBACK_BOOTSTRAP}
        </Script>
        <Script id="staff-theme-bootstrap" strategy="beforeInteractive">
          {STAFF_THEME_BOOTSTRAP}
        </Script>
        <Providers initialUser={user} initialRole={initialRole}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
