const STEPS = [
  {
    title: "Создайте заявку",
    text: "Выберите направление, сумму и заполните данные в форме.",
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

export default function ExchangeHowItWorks() {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <h3 className="text-zinc-900 font-bold text-xl mb-4">Как проходит обмен</h3>

      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#FFDD2D] text-zinc-900 text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-sm font-bold text-zinc-900 leading-snug">
                {step.title}
              </div>
              <p className="text-xs font-medium text-zinc-500 leading-relaxed mt-1">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
