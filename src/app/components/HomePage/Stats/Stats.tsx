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
    <section className="w-full">
      <h2 className="text-center text-2xl sm:text-[28px] font-bold tracking-tight text-zinc-900">
        Aurum Swap в цифрах
      </h2>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-3 py-6 text-center shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 tabular-nums">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 leading-snug">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
