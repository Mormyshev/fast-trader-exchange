export function orderPublicNumber(
  order: { order_number?: number | null } | null | undefined,
): string | null {
  const value = Number(order?.order_number);
  if (!Number.isFinite(value) || value <= 0) return null;
  return String(Math.trunc(value));
}

export function orderPublicTitle(
  order: { order_number?: number | null } | null | undefined,
): string {
  const number = orderPublicNumber(order);
  return number ? `Заявка № ${number}` : "Заявка";
}

export function isOrderNumberColumnMissing(
  error: { message?: string } | null | undefined,
): boolean {
  const message = error?.message ?? "";
  return (
    /order_number/i.test(message) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message))
  );
}

export function stripOrderNumberField(fields: string): string {
  return fields
    .replace(/,\s*order_number\b/g, "")
    .replace(/\border_number\s*,\s*/g, "");
}
