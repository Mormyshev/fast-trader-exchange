"use client";

export default function ExchangeNotice() {
    const steps = [
        "Заполните все поля представленной формы. Нажмите кнопку «ОБМЕНЯТЬ».",
        "Ознакомьтесь с условиями договора на оказание услуг обмена, если вы принимаете их, поставьте галочку в соответствующем поле/нажмите кнопку «Принимаю» («Согласен»). Еще раз проверьте данные заявки.",
        "Оплатите заявку. Для этого следует совершить перевод необходимой суммы, следуя инструкциям на нашем сайте.",
        "После выполнения указанных действий, система переместит Вас на страницу «Состояние заявки», где будет указан статус вашего перевода.",
    ];

    return (
        /* 
          Senior-решение по адаптивным отступам:
          - Убраны max-w-3xl, mx-auto и внешние px-4. Теперь блок занимает 100% ширины левой колонки.
          - Инлайновый style заменен на адаптивные Tailwind-классы p-5 md:p-8.
        */
        <div className="w-full mt-6">
            <div className="w-full bg-[#FFF9CE] dark:bg-amber-950/25 text-zinc-800 dark:text-zinc-200 rounded-[32px] border border-amber-200/30 p-5 md:p-8 shadow-xs antialiased text-left">
                {/* Заголовок направления обмена */}
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 leading-snug">
                    Обмен Наличные RUB на Tether TRC20 USDT
                </h2>

                {/* Подзаголовок */}
                <p className="text-xs md:text-sm font-semibold text-zinc-700 dark:text-zinc-400 mb-4 leading-relaxed">
                    Для обмена Вам необходимо выполнить несколько шагов:
                </p>

                {/* Список инструкций */}
                <ol className="space-y-4 text-xs md:text-sm font-medium leading-relaxed tracking-tight text-zinc-600 dark:text-zinc-400">
                    {steps.map((step, index) => (
                        <li
                            key={index}
                            className="flex items-start justify-start text-left"
                        >
                            {/* Фиксированный маркер номера */}
                            <span className="font-bold text-zinc-700 dark:text-zinc-300 mr-2 shrink-0 select-none">
                                {index + 1}.
                            </span>
                            <span className="block">{step}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
