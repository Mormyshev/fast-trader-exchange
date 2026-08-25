import { ArrowRight, Check, X } from "lucide-react";

const STEPS = [
  {
    id: "created",
    title: "Заявка",
    pendingHint: "Ожидайте оператора",
    processingHint: "Оператор готовит реквизиты",
  },
  {
    id: "payment",
    title: "Оплата",
    hint: "Оплатите заявку",
  },
  {
    id: "review",
    title: "Проверка",
    hint: "Платёж проверяется",
  },
  {
    id: "done",
    title: "Выплата",
    hint: "Средства отправлены",
  },
] as const;

function currentIndex(status: string): number {
  switch (status) {
    case "awaiting_payment":
      return 1;
    case "paid":
      return 2;
    case "completed":
      return 3;
    case "cancelled":
    case "failed":
      return -1;
    default:
      return 0;
  }
}

function currentHint(status: string, index: number) {
  if (index === 0) {
    return status === "processing"
      ? STEPS[0].processingHint
      : STEPS[0].pendingHint;
  }
  if (index === 1) return STEPS[1].hint;
  if (index === 2) return STEPS[2].hint;
  return STEPS[3].hint;
}

function Circle({
  state,
}: {
  state: "done" | "current" | "todo" | "cancelled";
}) {
  const base =
    "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full shrink-0";
  if (state === "done") {
    return (
      <span className={`${base} bg-emerald-500 text-white`}>
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className={`${base} bg-[#FFDD2D] text-zinc-900`}>
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "cancelled") {
    return (
      <span className={`${base} bg-rose-500 text-white`}>
        <X className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  return <span className={`${base} border-2 border-zinc-200 bg-white`} />;
}

export default function OrderProgressStepper({
  status,
  embedded = false,
}: {
  status: string;
  embedded?: boolean;
}) {
  const cancelled = status === "cancelled" || status === "failed";
  const index = cancelled ? 0 : currentIndex(status);
  const doneCount = cancelled ? 0 : index;
  const restCount = cancelled ? STEPS.length - 1 : STEPS.length - index - 1;
  const title = cancelled ? "Отменена" : STEPS[index]?.title;
  const hint = cancelled
    ? "Заявка закрыта"
    : currentHint(status, index);

  return (
    <div
      className={
        embedded
          ? "rounded-2xl bg-[#F4F5F7] px-3.5 py-3"
          : "rounded-2xl bg-white px-4 py-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
      }
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {Array.from({ length: doneCount }).map((_, i) => (
          <Circle key={`done-${i}`} state="done" />
        ))}
        <Circle state={cancelled ? "cancelled" : "current"} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900 leading-tight">
            {title}
          </p>
          <p className="text-xs font-medium text-zinc-400 leading-tight mt-0.5">
            {hint}
          </p>
        </div>
        <div className="flex-1 min-w-2" />
        {Array.from({ length: restCount }).map((_, i) => (
          <Circle key={`todo-${i}`} state="todo" />
        ))}
      </div>
    </div>
  );
}
