import { formatStaffOperatorLabel } from "@/src/utils/orders/operator-snapshot";

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
      className={`inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
      title="Внутренняя подпись оператора"
    >
      Оператор: {label}
    </span>
  );
}
