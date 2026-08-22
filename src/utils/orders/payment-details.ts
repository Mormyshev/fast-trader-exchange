import { validatePhone } from "@/src/utils/validation/common";
import {
  isCryptoOrderCode,
  orderCodeToCurrencyId,
  validateCryptoWallet,
} from "@/src/utils/validation/wallet";
import { findSbpBank } from "@/src/utils/banks/sbp-banks";

export type PaymentRequisites = {
  kind: "sbp" | "fiat" | "crypto" | "legacy" | "empty";
  card: string;
  phone: string;
  wallet: string;
  bankId: string;
  bankName: string;
  legacy?: string;
};

const emptyRequisites = (): PaymentRequisites => ({
  kind: "empty",
  card: "",
  phone: "",
  wallet: "",
  bankId: "",
  bankName: "",
});

export function validateSbpPaymentRequisites(
  phone: string,
  bankId: string,
):
  | { ok: true; phone: string; bankId: string; bankName: string }
  | { ok: false; error: string } {
  const bank = findSbpBank(bankId);
  if (!bank) {
    return { ok: false, error: "Выберите банк СБП" };
  }

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) {
    return { ok: false, error: phoneCheck.error };
  }

  return {
    ok: true,
    phone: phoneCheck.value,
    bankId: bank.id,
    bankName: bank.name,
  };
}

export function serializeSbpPaymentDetails(
  phone: string,
  bankId: string,
): string {
  const bank = findSbpBank(bankId);
  return JSON.stringify({
    v: 2,
    kind: "sbp",
    phone: phone.trim(),
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
        return {
          ...empty,
          kind: "sbp",
          phone: typeof parsed.phone === "string" ? parsed.phone : "",
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
  input: { phone: string; wallet: string; bankId: string },
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

  const sbp = validateSbpPaymentRequisites(input.phone, input.bankId);
  if (!sbp.ok) return { ok: false, error: sbp.error };
  return {
    ok: true,
    payload: serializeSbpPaymentDetails(sbp.phone, sbp.bankId),
    summary: `СБП ${sbp.bankName}, ${sbp.phone}`,
  };
}
