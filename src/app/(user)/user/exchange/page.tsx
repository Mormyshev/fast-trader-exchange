import { Suspense } from "react";
import NoticeMessage from "@/src/components/NoticeMessage/NoticeMessage";
import OrderForm from "../../../components/ExchangePage/OrderForm/OrderForm";
import ExchangeNotice from "@/src/components/ExchangeNotice/ExchangeNotice";
import ExchangeRates from "@/src/components/ExchangeRates/ExchangeRates";
import ExchangeHowItWorks from "@/src/components/ExchangeHowItWorks/ExchangeHowItWorks";
import Reviews from "../../../../components/Reviews/Reviews";

function ExchangeFormFallback() {
  return (
    <div className="w-full h-96 rounded-[40px] bg-[#FFFDE7] dark:bg-amber-950/20 animate-pulse" />
  );
}

export default function ExchangePage() {
  return (
    <main className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mb-32 mt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] items-start">
        <section
          className="w-full flex flex-col gap-6"
          aria-label="Форма обмена"
        >
          <NoticeMessage />
          <Suspense fallback={<ExchangeFormFallback />}>
            <OrderForm />
            <ExchangeNotice />
          </Suspense>
        </section>

        <aside
          className="w-full flex flex-col gap-6 lg:sticky lg:top-24"
          aria-label="Информационная панель"
        >
          <ExchangeRates />
          <ExchangeHowItWorks />
          <Reviews />
        </aside>
      </div>
    </main>
  );
}
