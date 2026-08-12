"use client";

import ExchangeCalculator from "../components/ExchangeCalculator/ExchangeCalculator";
import Advantages from "./components/HomePage/Advantages/Advantages";
import Stats from "./components/HomePage/Stats/Stats";

// Импортируем компоненты публичной обвязки сюда
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Features from "../components/Features/Features";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-200">
      <Header />

      <main className="main-content flex-grow w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-6 bg-transparent">
          <Features />
        </div>

        <div id="exchange" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 md:space-y-8 scroll-mt-24">
          <ExchangeCalculator />
          <Advantages />
          <Stats />
        </div>
      </main>

      <Footer />
    </div>
  );
}
