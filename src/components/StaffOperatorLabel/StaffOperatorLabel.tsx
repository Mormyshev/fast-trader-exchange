import { formatStaffOperatorLabel } from "@/src/utils/orders/operator-snapshot";

const OPERATOR_BADGE_TONES = [
  "bg-amber-100 text-amber-900 border-amber-200",
  "bg-sky-100 text-sky-900 border-sky-200",
  "bg-violet-100 text-violet-900 border-violet-200",
  "bg-teal-100 text-teal-900 border-teal-200",
  "bg-rose-100 text-rose-900 border-rose-200",
  "bg-lime-100 text-lime-900 border-lime-200",
  "bg-orange-100 text-orange-900 border-orange-200",
  "bg-indigo-100 text-indigo-900 border-indigo-200",
  "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  "bg-cyan-100 text-cyan-900 border-cyan-200",
] as const;

function operatorBadgeTone(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return OPERATOR_BADGE_TONES[hash % OPERATOR_BADGE_TONES.length];
}

export default function StaffOperatorLabel({
  snapshot,
  className = "",
}: {
  snapshot?: string | null;
  className?: string;
}) {
  const label = formatStaffOperatorLabel(snapshot);
  if (!label) return null;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-normal break-words ${operatorBadgeTone(label)} ${className}`}
      title="Внутренняя подпись оператора"
    >
      Оператор: {label}
    </span>
  );
}
