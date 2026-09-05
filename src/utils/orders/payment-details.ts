import { findSbpBank } from "@/src/utils/banks/sbp-banks";
import {
  isCryptoOrderCode,
  orderCodeToCurrencyId,
  validateCryptoWallet,
} from "@/src/utils/validation/wallet";
import {
  detectSbpPayoutMethod,
  type SbpPayoutMethod,
  validateSbpDestination,
} from "@/src/utils/validation/sbp-payout";

export type PaymentRequisites = {
  kind: "sbp" | "fiat" | "crypto" | "legacy" | "empty";
  method: SbpPayoutMethod | "";
  card: string;
  phone: string;
  wallet: string;
  bankId: string;
  bankName: string;
  legacy?: string;
};

const emptyRequisites = (): PaymentRequisites => ({
  kind: "empty",
  method: "",
  card: "",
  phone: "",
  wallet: "",
  bankId: "",
  bankName: "",
});

export function validateSbpPaymentRequisites(
  destination: string,
  bankId: string,
  method?: SbpPayoutMethod,
):
  | {
      ok: true;
      method: SbpPayoutMethod;
      phone: string;
      card: string;
      bankId: string;
      bankName: string;
    }
  | { ok: false; error: string } {
  const bank = findSbpBank(bankId);
  if (!bank) {
    return {
      ok: false,
      error:
        method === "card" ? "Выберите банк карты" : "Выберите банк СБП",
    };
  }

  const resolved = method ?? detectSbpPayoutMethod(destination);
  const destCheck = validateSbpDestination(destination, resolved);
  if (!destCheck.ok) {
    return { ok: false, error: destCheck.error };
  }

  return {
    ok: true,
    method: resolved,
    phone: resolved === "sbp" ? destCheck.value : "",
    card: resolved === "card" ? destCheck.value : "",
    bankId: bank.id,
    bankName: bank.name,
  };
}

export function serializeSbpPaymentDetails(
  destination: string,
  bankId: string,
  method?: SbpPayoutMethod,
): string {
  const bank = findSbpBank(bankId);
  const resolved = method ?? detectSbpPayoutMethod(destination);
  const value = destination.trim();
  return JSON.stringify({
    v: 2,
    kind: "sbp",
    method: resolved,
    phone: resolved === "sbp" ? value : "",
    card: resolved === "card" ? value : "",
    bankId,
    bankName: bank?.name ?? "",
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
  const empty = emptyRequisites();
  if (!raw?.trim()) return empty;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      if (parsed.kind === "crypto" && typeof parsed.wallet === "string") {
        return {
          ...empty,
          kind: "crypto",
          wallet: parsed.wallet,
        };
      }

      if (parsed.kind === "sbp") {
        const bankId = typeof parsed.bankId === "string" ? parsed.bankId : "";
        const bank = findSbpBank(bankId);
        const phone = typeof parsed.phone === "string" ? parsed.phone : "";
        const card = typeof parsed.card === "string" ? parsed.card : "";
        const method: SbpPayoutMethod =
          parsed.method === "card" || parsed.method === "sbp"
            ? parsed.method
            : card
              ? "card"
              : "sbp";
        return {
          ...empty,
          kind: "sbp",
          method,
          phone,
          card,
          bankId,
          bankName:
            bank?.name ||
            (typeof parsed.bankName === "string" ? parsed.bankName : ""),
        };
      }

      if (
        (parsed.v === 1 || parsed.v === 2 || parsed.kind === "fiat") &&
        typeof parsed.card === "string"
      ) {
        return {
          ...empty,
          kind: "fiat",
          method: "card",
          card: parsed.card,
          phone: typeof parsed.phone === "string" ? parsed.phone : "",
        };
      }
    }
  } catch {
    // old free-text requisites
  }

  return { ...empty, kind: "legacy", legacy: raw };
}

export function hasPaymentRequisites(
  raw: string | null | undefined,
): boolean {
  const parsed = parsePaymentDetails(raw);
  return Boolean(
    parsed.card ||
      parsed.phone ||
      parsed.wallet ||
      parsed.bankId ||
      parsed.legacy,
  );
}

export function clientPaysWithCrypto(currencyFrom: string): boolean {
  return isCryptoOrderCode(currencyFrom);
}

export function buildOperatorPaymentDetails(
  currencyFrom: string,
  input: {
    phone: string;
    wallet: string;
    bankId: string;
    method?: SbpPayoutMethod;
  },
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

  const sbp = validateSbpPaymentRequisites(
    input.phone,
    input.bankId,
    input.method,
  );
  if (!sbp.ok) return { ok: false, error: sbp.error };
  const destination = sbp.card || sbp.phone;
  return {
    ok: true,
    payload: serializeSbpPaymentDetails(destination, sbp.bankId, sbp.method),
    summary:
      sbp.method === "card"
        ? `Карта ${sbp.bankName}, ${destination}`
        : `СБП ${sbp.bankName}, ${destination}`,
  };
}
