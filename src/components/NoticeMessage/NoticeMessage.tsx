"use client";

import { useState } from "react";

export default function NoticeMessage() {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        /* 
          Senior-решение для управления отступами:
          - w-full заставляет плашку идеально вставать в один край с формой на десктопе.
          - md:p-8 задает комфортные внутренние отступы на ПК, а p-5 — компактные на смартфонах.
          - Все лишние mx-auto и max-w удалены, управление шириной передано глобальной сетке.
        */
        <div className="w-full p-5 md:p-8 rounded-3xl border border-white shadow-[0_12px_24px_rgba(0,0,0,0.04)] bg-gradient-to-b from-[#FFF6C7]/80 to-[#FFEE94]/80 text-zinc-900 relative transition-all duration-300 antialiased">
            {/* Контентная область сообщения */}
            <div className="pr-2">
                <ul className="list-disc list-inside space-y-3.5 text-xs md:text-[13px] font-medium leading-relaxed tracking-tight text-left">
                    {/* Пункт 1 */}
                    <li className="marker:text-zinc-500">
                        Для оформления заявки, Вам необходимо заполнить форму
                        обмена, представленную ниже. При возникновении вопросов
                        обратитесь в онлайн чат или{" "}
                        <a
                            href="tg://resolve?domain=finex24cash"
                            className="text-gray-500 font-bold hover:underline transition-all"
                        >
                            Telegram
                        </a>
                        .
                    </li>

                    {/* Пункт 2 */}
                    <li className="marker:text-zinc-500">
                        Наш офис в Москве:{" "}
                        <strong className="font-bold text-zinc-950">
                            Пресненская набережная 12 (Москва-Сити).
                        </strong>
                    </li>

                    {/* Пункт 3 */}
                    <li className="marker:text-zinc-500">
                        Сумма к получению считается после ПОЛНОГО пересчета и
                        получения заявки статуса "Оплаченная".
                    </li>

                    {/* Пункт 4 */}
                    <li className="marker:text-zinc-500">
                        Комиссия обменного пункта уже включена в курс обмена,
                        основываясь на рынке в данном регионе. Курс формируется
                        с использованием данных{" "}
                        <span className="font-semibold">Rapira.net</span> и
                        может включать в себя комиссию до 1%.
                    </li>

                    {/* Пункт 5 */}
                    <li className="marker:text-zinc-500">
                        На сделки с наличными обменами допускаются лица не
                        младше 18 и не старше 53 лет.
                    </li>
                </ul>
            </div>
        </div>
    );
}
