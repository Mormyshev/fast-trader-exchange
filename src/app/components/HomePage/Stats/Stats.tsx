import { Clock, Headphones, List, ShieldCheck } from "lucide-react";

const facts = [
  {
    title: "15 минут",
    label: "курс фиксируется в заявке",
    icon: Clock,
  },
  {
    title: "AML",
    label: "проверка адреса перед обменом",
    icon: ShieldCheck,
  },
  {
    title: "Чат",
    label: "оператор на связи по заявке",
    icon: Headphones,
  },
  {
    title: "RUB ↔ крипта",
    label: "USDT, BTC, ETH, TON, SOL",
    icon: List,
  },
];

export default function Stats() {
  return (
    <section className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-3">
      {facts.map((fact) => {
        const Icon = fact.icon;
        return (
          <div
            key={fact.title}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800 border border-amber-100">
              <Icon className="h-4 w-4 stroke-[2.2]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-zinc-900">
                {fact.title}
              </p>
              <p className="text-[11px] font-medium leading-snug text-zinc-500">
                {fact.label}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
