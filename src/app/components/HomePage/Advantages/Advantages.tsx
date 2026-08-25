import { Bitcoin, Lock, MessageCircle } from "lucide-react";

const advantages = [
  {
    title: "Безопасность и защита средств",
    description:
      "Все операции проходят внутри защищённой площадки с AML-контролем и проверкой оператором.",
    icon: Lock,
  },
  {
    title: "Быстрый обмен и выгодный курс",
    description:
      "Заявка в несколько шагов, перевод по СБП и криптоактивы в одном интерфейсе.",
    icon: Bitcoin,
  },
  {
    title: "Оперативная поддержка",
    description:
      "Служба поддержки на связи 24/7 и поможет с любой заявкой на демо-площадке.",
    icon: MessageCircle,
  },
];

export default function Advantages() {
  return (
    <section className="w-full">
      <h2 className="text-center text-2xl sm:text-[28px] font-bold tracking-tight text-zinc-900">
        Почему выбирают Aurum Swap
      </h2>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        {advantages.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="flex flex-col items-center rounded-2xl bg-white px-6 py-8 text-center shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF4C2]">
                <Icon className="h-6 w-6 text-[#C9A227] stroke-[1.75]" />
              </div>
              <h3 className="mt-5 text-[15px] font-bold tracking-tight text-zinc-900">
                {item.title}
              </h3>
              <p className="mt-2 max-w-[16rem] text-sm font-medium leading-relaxed text-zinc-600">
                {item.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
