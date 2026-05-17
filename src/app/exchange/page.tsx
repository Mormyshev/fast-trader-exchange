// src/app/exchange/page.tsx
import NoticeMessage from "@/src/components/NoticeMessage/NoticeMessage";
import OrderForm from "../components/ExchangePage/OrderForm/OrderForm";
import ExchangeNotice from "@/src/components/ExchangeNotice/ExchangeNotice";
import LatestExchanges from "../../components/LatestExchanges/LatestExchanges";
import Reviews from "../../components/Reviews/Reviews";

export default function ExchangePage() {
    return (
        // Контейнер-ограничитель (Обеспечивает центрирование интерфейса на UltraWide мониторах)
        <main className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mb-32 mt-8">
            {/* 
              СОВРЕМЕННАЯ СЕТКА:
              - На мобильных (col-1) элементы встают в один ряд с отступом gap-6
              - На десктопе (lg) превращается в красивый 2-колонный макет
              - items-start выравнивает верхние края левой и правой панели
            */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] items-start">
                {/* СЕКЦИЯ КОНТЕНТА: Семантический тег <section> вместо <div> */}
                <section
                    className="w-full flex flex-col gap-6"
                    aria-label="Форма обмена"
                >
                    <NoticeMessage />
                    <OrderForm />
                    <ExchangeNotice />
                </section>

                {/* САЙДБАР: Семантический тег <aside> */}
                {/* lg:sticky удерживает виджеты на экране при прокрутке длинной формы */}
                <aside
                    className="w-full flex flex-col gap-6 lg:sticky lg:top-6"
                    aria-label="Информационная панель"
                >
                    <LatestExchanges />
                    <Reviews />
                </aside>
            </div>
        </main>
    );
}
