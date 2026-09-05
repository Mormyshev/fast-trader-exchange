import { formatOrderMoney } from "@/src/components/staff/OrderExchangePair";
import {
  findCurrencyByOrderCode,
} from "@/src/utils/exchange-currencies";
import { formatVerifiedFio } from "@/src/utils/orders/client-info";
import { orderPublicTitle } from "@/src/utils/orders/public-number";

export const SUPPORT_APPEAL_MIN = 10;
export const SUPPORT_APPEAL_MAX = 2000;
export const SUPPORT_APPEAL_MAX_FILES = 5;

export function supportOrderStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Ожидает оператора";
    case "processing":
      return "В обработке";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Платёж проверяется";
    case "completed":
      return "Выполнена";
    case "cancelled":
      return "Отменена";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
}

function currencyLine(orderCode: string, amount: number) {
  const currency = findCurrencyByOrderCode(orderCode);
  const code = currency?.code ?? orderCode.replace(/_/g, " ");
  const network = currency?.network?.shortLabel;
  return `${formatOrderMoney(amount, orderCode)} ${code}${
    network && network !== code ? ` · ${network}` : ""
  }`;
}

export function formatOrderExchangeLine(order: {
  amount_from?: number;
  amount_to?: number;
  currency_from?: string;
  currency_to?: string;
}) {
  return `${currencyLine(String(order.currency_from || ""), Number(order.amount_from || 0))} → ${currencyLine(String(order.currency_to || ""), Number(order.amount_to || 0))}`;
}

export function parseAppealDescription(value: unknown): {
  ok: true;
  value: string;
} | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "Опишите проблему" };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Опишите проблему" };
  }
  if (trimmed.length < SUPPORT_APPEAL_MIN) {
    return {
      ok: false,
      error: `Описание: минимум ${SUPPORT_APPEAL_MIN} символов`,
    };
  }
  if (trimmed.length > SUPPORT_APPEAL_MAX) {
    return {
      ok: false,
      error: `Описание: максимум ${SUPPORT_APPEAL_MAX} символов`,
    };
  }
  return { ok: true, value: trimmed };
}

export function buildSupportAppealMessage({
  order,
  profile,
  email,
  description,
}: {
  order: {
    order_number?: number | null;
    status?: string;
    amount_from?: number;
    amount_to?: number;
    currency_from?: string;
    currency_to?: string;
  };
  profile?: {
    last_name?: string | null;
    first_name?: string | null;
    middle_name?: string | null;
    telegram?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  email?: string | null;
  description: string;
}) {
  const fio = formatVerifiedFio(profile ?? {});
  const clientEmail =
    (typeof profile?.email === "string" && profile.email.trim()) ||
    email?.trim() ||
    "—";
  const telegram =
    typeof profile?.telegram === "string" && profile.telegram.trim()
      ? profile.telegram.trim()
      : "—";
  const phone =
    typeof profile?.phone === "string" && profile.phone.trim()
      ? profile.phone.trim()
      : "—";

  return [
    `Обращение по заявке: ${orderPublicTitle(order)}`,
    `Статус: ${supportOrderStatusLabel(String(order.status || ""))}`,
    `Обмен: ${formatOrderExchangeLine(order)}`,
    "",
    "Клиент:",
    `ФИО: ${fio || "—"}`,
    `E-mail: ${clientEmail}`,
    `Telegram: ${telegram}`,
    `Телефон: ${phone}`,
    "",
    "Описание проблемы:",
    description,
  ].join("\n");
}
