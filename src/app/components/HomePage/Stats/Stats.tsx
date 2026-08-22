const stats = [
  { value: "98 498", label: "пользователей" },
  { value: "600 000+", label: "обменов" },
  { value: "12 000+", label: "отзывов на Bestchange" },
  { value: "24/7", label: "служба поддержки" },
  { value: "1 000+", label: "направлений обмена" },
  { value: "1 млн $+", label: "резервы" },
];

export default function Stats() {
  return (
    <section className="rounded-[32px] border border-zinc-200/80 bg-white px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
        Показатели
      </p>
      <h2 className="mt-2 text-center text-xl sm:text-2xl font-semibold tracking-tight text-[#1A1A1A]">
        Aurum Swap в цифрах
      </h2>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-6">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 text-center">
            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 leading-snug">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
