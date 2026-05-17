import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Features from "../components/Features/Features";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Fast Trader Exchange",
    description: "Надежный сервис обмена цифровых активов",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="ru"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
            suppressHydrationWarning
        >
            {/* Явно добавляем bg-white и dark:bg-zinc-950 на уровень body */}
            <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-200">
                <Providers>
                    {/* Хедер идет на всю ширину экрана */}
                    <Header />

                    {/* 
                      Глобальный контейнер контента:
                      Добавляем bg-white dark:bg-zinc-950, чтобы перекрыть встроенный черный фон Next.js
                    */}
                    <main className="main-content flex-grow w-full bg-white dark:bg-zinc-950 transition-colors duration-200">
                        {/* 
                          ИСПРАВЛЕНО: Features теперь находится внутри main. 
                          Добавлен класс bg-transparent, чтобы он не конфликтовал со страницами.
                        */}
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-6 bg-transparent">
                            <Features />
                        </div>

                        <div
                            className="smooth-scroll-container h-full bg-transparent"
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            {children}
                        </div>
                    </main>

                    {/* Футер идет на всю ширину экрана */}
                    <Footer />
                </Providers>
            </body>
        </html>
    );
}
