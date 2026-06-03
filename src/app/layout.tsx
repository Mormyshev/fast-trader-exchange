import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Features from "../components/Features/Features";

const roboto = Roboto({
    variable: "--font-roboto",
    subsets: ["latin", "cyrillic"],
    display: "swap",
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
        <html lang="ru" className="h-full antialiased">
            <body
                className={`${roboto.className} min-h-full flex flex-col bg-white text-zinc-900`}
            >
                <Providers>
                    <Header />
                    <main className="main-content flex-grow w-full bg-white">
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
                    <Footer />
                </Providers>
            </body>
        </html>
    );
}
