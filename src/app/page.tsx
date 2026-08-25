import ExchangeCalculator from "../components/ExchangeCalculator/ExchangeCalculator";
import Advantages from "./components/HomePage/Advantages/Advantages";
import Stats from "./components/HomePage/Stats/Stats";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Features from "../components/Features/Features";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-50">
      <Header />

      <main className="main-content w-full flex-grow">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 pt-5 pb-10 sm:space-y-10 sm:px-5 sm:pt-6 sm:pb-14 md:space-y-12 md:px-6 md:pt-8 md:pb-16 lg:px-8">
          <Features />
          <div id="exchange" className="scroll-mt-24">
            <ExchangeCalculator />
          </div>
          <Advantages />
          <Stats />
        </div>
      </main>

      <Footer />
    </div>
  );
}
