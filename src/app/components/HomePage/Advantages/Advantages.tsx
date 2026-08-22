const STEPS = [
  {
    title: "Создайте заявку",
    text: "Выберите направление, сумму и заполните данные в калькуляторе.",
  },
  {
    title: "Оплатите обмен",
    text: "Переведите средства по инструкции на странице заявки.",
  },
  {
    title: "Дождитесь проверки",
    text: "Оператор подтвердит поступление и подготовит выплату.",
  },
  {
    title: "Получите средства",
    text: "Крипта или рубли поступят на указанные реквизиты.",
  },
];

export default function Advantages() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 md:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Как проходит обмен
      </h2>
      <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="min-w-0 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3.5"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFDD2D] text-xs font-bold text-zinc-900">
              {index + 1}
            </span>
            <h3 className="mt-3 text-sm font-bold text-zinc-900 leading-snug">
              {step.title}
            </h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-500">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
