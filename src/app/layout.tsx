import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import { cookies, headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";
import "./staff-theme.css";
import "./site-theme.css";
import { createClient } from "@/src/utils/supabase/server";
import { parseStaffTheme, STAFF_THEME_COOKIE } from "@/src/utils/staff/theme";
import {
    isStaffPath,
    parseSiteTheme,
    SITE_THEME_COOKIE,
} from "@/src/utils/theme";

const AUTH_CALLBACK_BOOTSTRAP = `(function(){try{var p=location.pathname;if(p==="/auth/callback"||p==="/auth/confirm")return;var s=location.search;if(s.indexOf("code=")<0&&s.indexOf("token_hash=")<0)return;var u=new URL("/auth/callback"+s,location.origin);if(!u.searchParams.get("next")&&(p.indexOf("/auth/reset-password")===0||u.searchParams.get("type")==="recovery"))u.searchParams.set("next","/auth/reset-password");location.replace(u.pathname+u.search);}catch(e){}})();`;

const THEME_BOOTSTRAP = `(function(){try{var p=location.pathname;var staff=p.indexOf("/operator")===0||p.indexOf("/admin")===0;var key=staff?"fte-staff-theme":"fte-theme";var m=document.cookie.match(new RegExp("(?:^|; )"+key+"=([^;]*)"));var d=m&&m[1]==="dark";document.documentElement.classList.toggle("dark",!!d);document.documentElement.classList.toggle("staff-dark",!!(staff&&d));}catch(e){}})();`;

const roboto = Roboto({
    variable: "--font-roboto",
    subsets: ["latin", "cyrillic"],
    display: "swap",
    weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
    title: "FastTraderExchange",
    description: "Площадка обмена валют",
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

    const headerList = await headers();
    const cookieStore = await cookies();
    const pathname = headerList.get("x-pathname") || "";
    const onStaff = isStaffPath(pathname);
    const siteTheme = parseSiteTheme(
        cookieStore.get(SITE_THEME_COOKIE)?.value,
    );
    const staffDark =
        onStaff &&
        parseStaffTheme(cookieStore.get(STAFF_THEME_COOKIE)?.value) === "dark";
    const siteDark = !onStaff && siteTheme === "dark";

    return (
        <html
            lang="ru"
            suppressHydrationWarning
            className={`${roboto.variable} h-full antialiased${staffDark ? " dark staff-dark" : siteDark ? " dark" : ""}`}
        >
            <body
                className={`${roboto.className} font-sans min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}
            >
                <Script
                    id="auth-callback-bootstrap"
                    strategy="beforeInteractive"
                >
                    {AUTH_CALLBACK_BOOTSTRAP}
                </Script>
                <Script id="theme-bootstrap" strategy="beforeInteractive">
                    {THEME_BOOTSTRAP}
                </Script>
                <Providers
                    initialUser={user}
                    initialRole={initialRole}
                    initialSiteTheme={siteTheme}
                >
                    {children}
                </Providers>
            </body>
        </html>
    );
}
