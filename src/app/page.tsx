"use client";

import ExchangeCalculator from "../components/ExchangeCalculator/ExchangeCalculator";
import Advantages from "./components/HomePage/Advantages/Advantages";
import Stats from "./components/HomePage/Stats/Stats";

export default function Home() {
    return (
        <main className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 md:space-y-8">
                <ExchangeCalculator />
                <Advantages />
                <Stats />
            </div>
        </main>
    );
}
