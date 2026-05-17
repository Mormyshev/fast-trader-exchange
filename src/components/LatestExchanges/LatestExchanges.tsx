"use client";

// Типизация для обмена
interface ExchangeItem {
    id: string;
    fromCurrency: string;
    toCurrency: string;
    date: string;
    fromAmount: string;
    toAmount: string;
    fromIcon: string; // Символ или текст для иконки
    toIcon: string;
    fromBg: string; // Tailwind класс цвета фона иконки
    toBg: string;
}

const mockExchanges: ExchangeItem[] = [
    {
        id: "1",
        fromCurrency: "BTC",
        toCurrency: "RUB",
        date: "17.05.2026, 08:06",
        fromAmount: "0.015...",
        toAmount: "9680...",
        fromIcon: "฿",
        toIcon: "А",
        fromBg: "bg-orange-500",
        toBg: "bg-red-600",
    },
];

export default function LatestExchanges() {
    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <h3 className="text-zinc-900 font-bold text-xl mb-4">
                Последние обмены
            </h3>

            <div className="space-y-3">
                {mockExchanges.map((exchange) => (
                    <div
                        key={exchange.id}
                        className="border border-gray-100 rounded-2xl p-4 bg-gray-50/30"
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-zinc-800 text-sm">
                                {exchange.fromCurrency} &rarr;{" "}
                                {exchange.toCurrency}
                            </span>
                        </div>
                        <span className="text-xs text-zinc-400 block mb-3">
                            {exchange.date}
                        </span>

                        <div className="flex items-center gap-2 border-t border-gray-100/70 pt-3">
                            {/* Отдаем */}
                            <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-gray-100">
                                <span
                                    className={`w-5 h-5 ${exchange.fromBg} text-white rounded-full flex items-center justify-center text-[10px] font-bold`}
                                >
                                    {exchange.fromIcon}
                                </span>
                                <span className="text-xs font-medium text-zinc-600">
                                    <span className="text-zinc-900 font-semibold">
                                        {exchange.fromAmount}
                                    </span>{" "}
                                    {exchange.fromCurrency}
                                </span>
                            </div>

                            <span className="text-yellow-500 font-bold">
                                &rarr;
                            </span>

                            {/* Получаем */}
                            <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-gray-100">
                                <span
                                    className={`w-5 h-5 ${exchange.toBg} text-white rounded-full flex items-center justify-center text-[10px] font-bold`}
                                >
                                    {exchange.toIcon}
                                </span>
                                <span className="text-xs font-medium text-zinc-600">
                                    <span className="text-zinc-900 font-semibold">
                                        {exchange.toAmount}
                                    </span>{" "}
                                    {exchange.toCurrency}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
