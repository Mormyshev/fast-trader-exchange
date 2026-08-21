import { validatePhone } from "@/src/utils/validation/common";
import {
  isCryptoOrderCode,
  orderCodeToCurrencyId,
  validateCryptoWallet,
} from "@/src/utils/validation/wallet";

export type PaymentRequisites = {
  kind: "fiat" | "crypto" | "legacy" | "empty";
  card: string;
  phone: string;
  wallet: string;
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
    v: 2,
    kind: "fiat",
    card: card.trim(),
    phone: phone.trim(),
  });
}

export function serializeCryptoPaymentDetails(wallet: string): string {
  return JSON.stringify({
    v: 2,
    kind: "crypto",
    wallet: wallet.trim(),
  });
}

export function parsePaymentDetails(
  raw: string | null | undefined,
): PaymentRequisites {
  const empty: PaymentRequisites = {
    kind: "empty",
    card: "",
    phone: "",
    wallet: "",
  };
  if (!raw?.trim()) return empty;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      if (parsed.kind === "crypto" && typeof parsed.wallet === "string") {
        return {
          kind: "crypto",
          card: "",
          phone: "",
          wallet: parsed.wallet,
        };
      }
      if (
        (parsed.v === 1 || parsed.v === 2 || parsed.kind === "fiat") &&
        typeof parsed.card === "string"
      ) {
        return {
          kind: "fiat",
          card: parsed.card,
          phone: typeof parsed.phone === "string" ? parsed.phone : "",
          wallet: "",
        };
      }
    }
  } catch {
    // old free-text requisites
  }

  return { kind: "legacy", card: "", phone: "", wallet: "", legacy: raw };
}

export function hasPaymentRequisites(
  raw: string | null | undefined,
): boolean {
  const parsed = parsePaymentDetails(raw);
  return Boolean(
    parsed.card || parsed.phone || parsed.wallet || parsed.legacy,
  );
}

export function clientPaysWithCrypto(currencyFrom: string): boolean {
  return isCryptoOrderCode(currencyFrom);
}

export function buildOperatorPaymentDetails(
  currencyFrom: string,
  input: { card: string; phone: string; wallet: string },
): { ok: true; payload: string; summary: string } | { ok: false; error: string } {
  if (clientPaysWithCrypto(currencyFrom)) {
    const walletCheck = validateCryptoWallet(
      input.wallet,
      orderCodeToCurrencyId(currencyFrom),
    );
    if (!walletCheck.ok) return { ok: false, error: walletCheck.error };
    return {
      ok: true,
      payload: serializeCryptoPaymentDetails(walletCheck.value),
      summary: walletCheck.value,
    };
  }

  const fiat = validatePaymentRequisites(input.card, input.phone);
  if (!fiat.ok) return { ok: false, error: fiat.error };
  return {
    ok: true,
    payload: serializePaymentDetails(fiat.card, fiat.phone),
    summary: `Карта ${fiat.card}, телефон ${fiat.phone}`,
  };
}
