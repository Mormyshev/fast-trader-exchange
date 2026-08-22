/** Semantic colors for order statuses. */

export function orderStatusCardClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-white";
    case "processing":
      return "border-blue-200 bg-white";
    case "awaiting_payment":
      return "border-violet-200 bg-white";
    case "paid":
      return "border-teal-200 bg-white";
    case "completed":
      return "border-emerald-300 bg-emerald-50/60";
    case "cancelled":
    case "failed":
      return "border-rose-300 bg-rose-50/60";
    default:
      return "border-zinc-200 bg-white";
  }
}

export function orderStatusBannerClass(status: string): string {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "cancelled" || status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

export function orderStatusAccentClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-400";
    case "processing":
      return "bg-blue-400";
    case "awaiting_payment":
      return "bg-violet-400";
    case "paid":
      return "bg-teal-400";
    case "completed":
      return "bg-emerald-500";
    case "cancelled":
    case "failed":
      return "bg-rose-400";
    default:
      return "bg-zinc-300";
  }
}

export function orderStatusRowClass(status: string): string {
  switch (status) {
    case "pending":
      return "hover:bg-amber-50/70";
    case "processing":
      return "hover:bg-blue-50/70";
    case "awaiting_payment":
      return "hover:bg-violet-50/70";
    case "paid":
      return "hover:bg-teal-50/70";
    case "completed":
      return "bg-emerald-50/40 hover:bg-emerald-50/70";
    case "cancelled":
    case "failed":
      return "bg-rose-50/40 hover:bg-rose-50/70";
    default:
      return "hover:bg-zinc-50";
  }
}

export function orderStatusBadgeClass(
  status: string,
  withBorder = false,
): string {
  switch (status) {
    case "pending":
      return withBorder
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-amber-100 text-amber-800";
    case "processing":
      return withBorder
        ? "bg-blue-100 text-blue-900 border-blue-200"
        : "bg-blue-100 text-blue-800";
    case "awaiting_payment":
      return withBorder
        ? "bg-violet-100 text-violet-900 border-violet-200"
        : "bg-violet-100 text-violet-800";
    case "paid":
      return withBorder
        ? "bg-teal-100 text-teal-900 border-teal-200"
        : "bg-teal-100 text-teal-800";
    case "completed":
      return withBorder
        ? "bg-emerald-100 text-emerald-900 border-emerald-200"
        : "bg-emerald-100 text-emerald-800";
    case "cancelled":
    case "failed":
      return withBorder
        ? "bg-rose-100 text-rose-900 border-rose-200"
        : "bg-rose-100 text-rose-800";
    default:
      return withBorder
        ? "bg-zinc-100 text-zinc-700 border-zinc-200"
        : "bg-zinc-100 text-zinc-700";
  }
}
