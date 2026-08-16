import { validatePhone } from "@/src/utils/validation";

export type PaymentRequisites = {
  card: string;
  phone: string;
  legacy?: string;
};

export function formatCardInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function validatePaymentRequisites(
  card: string,
  phone: string,
): { ok: true; card: string; phone: string } | { ok: false; error: string } {
  const cardDigits = card.replace(/\D/g, "");
  if (cardDigits.length < 16 || cardDigits.length > 19) {
    return { ok: false, error: "Укажите номер карты банка (16–19 цифр)" };
  }

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) {
    return { ok: false, error: phoneCheck.error };
  }

  return {
    ok: true,
    card: formatCardInput(cardDigits),
    phone: phoneCheck.value,
  };
}

export function serializePaymentDetails(card: string, phone: string): string {
  return JSON.stringify({
    v: 1,
    card: card.trim(),
    phone: phone.trim(),
  });
}

export function parsePaymentDetails(
  raw: string | null | undefined,
): PaymentRequisites {
  if (!raw?.trim()) {
    return { card: "", phone: "" };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.v === 1 &&
      typeof parsed.card === "string"
    ) {
      return {
        card: parsed.card,
        phone: typeof parsed.phone === "string" ? parsed.phone : "",
      };
    }
  } catch {
    // old free-text requisites
  }

  return { card: "", phone: "", legacy: raw };
}

export function hasPaymentRequisites(
  raw: string | null | undefined,
): boolean {
  const parsed = parsePaymentDetails(raw);
  return Boolean(parsed.card || parsed.phone || parsed.legacy);
}
