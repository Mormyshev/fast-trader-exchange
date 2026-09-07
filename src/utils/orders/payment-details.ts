import { findSbpBank, isManualSbpBank, normalizeManualBankName, SBP_MANUAL_BANK_ID } from "@/src/utils/banks/sbp-banks";
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
  customBankName?: string,
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
  const manualName = normalizeManualBankName(customBankName ?? "");
  if (isManualSbpBank(bankId)) {
    if (manualName.length < 2) {
      return { ok: false, error: "Введите название банка" };
    }
    if (manualName.length > 80) {
      return { ok: false, error: "Слишком длинное название банка" };
    }
  } else if (!bank) {
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
    bankId: bank?.id ?? SBP_MANUAL_BANK_ID,
    bankName: bank?.name ?? manualName,
  };
}

export function serializeSbpPaymentDetails(
  destination: string,
  bankId: string,
  method?: SbpPayoutMethod,
  customBankName?: string,
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
    bankName: bank?.name ?? normalizeManualBankName(customBankName ?? ""),
  });
}

export function serializeCryptoPaymentDetails(wallet: string): string {
  return JSON.stringify({
    v: 2,
    kind: "crypto",
    wallet: wallet.trim(),
  });
}

export function attachPaymentIssuedAt(
  raw: string,
  issuedAt: string,
): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, issuedAt });
    }
  } catch {
    // free-text requisites
  }
  return JSON.stringify({
    v: 2,
    kind: "legacy",
    legacy: raw,
    issuedAt,
  });
}

export function paymentIssuedAtFromDetails(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed?.issuedAt === "string" && parsed.issuedAt.trim()) {
      return parsed.issuedAt;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Restart the order TTL after a cancelled → processing restore. */
export function attachTtlStartedAt(
  raw: string | null | undefined,
  startedAt: string,
): string {
  if (!raw?.trim()) {
    return JSON.stringify({ v: 2, ttlStartedAt: startedAt });
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify({
        ...parsed,
        ttlStartedAt: startedAt,
        issuedAt: startedAt,
      });
    }
  } catch {
    // free-text requisites
  }
  return JSON.stringify({
    v: 2,
    kind: "legacy",
    legacy: raw,
    ttlStartedAt: startedAt,
    issuedAt: startedAt,
  });
}

export function ttlStartedAtFromDetails(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed?.ttlStartedAt === "string" && parsed.ttlStartedAt.trim()) {
      return parsed.ttlStartedAt;
    }
  } catch {
    // ignore
  }
  return null;
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

      if (parsed.kind === "legacy" && typeof parsed.legacy === "string") {
        return { ...empty, kind: "legacy", legacy: parsed.legacy };
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

      if (typeof parsed.ttlStartedAt === "string" && parsed.ttlStartedAt.trim()) {
        return empty;
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
    bankName?: string;
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
    input.bankName,
  );
  if (!sbp.ok) return { ok: false, error: sbp.error };
  const destination = sbp.card || sbp.phone;
  return {
    ok: true,
    payload: serializeSbpPaymentDetails(
      destination,
      sbp.bankId,
      sbp.method,
      sbp.bankName,
    ),
    summary:
      sbp.method === "card"
        ? `Карта ${sbp.bankName}, ${destination}`
        : `СБП ${sbp.bankName}, ${destination}`,
  };
}
