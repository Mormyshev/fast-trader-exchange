import { findSbpBank, findSbpBankByName, isManualSbpBank, normalizeManualBankName, SBP_MANUAL_BANK_ID } from "@/src/utils/banks/sbp-banks";
import { digitsOnly, formatCardInput, validateCardNumber } from "./card";
import { formatPhoneInput, validatePhone } from "./common";
import { validationError, validationOk, type ValidationResult } from "./types";

const SEP = " · ";
const METHOD_SBP = "СБП";
const METHOD_CARD = "Карта";

export type SbpPayoutMethod = "sbp" | "card";
/** @deprecated используйте SbpPayoutMethod */
export type SbpDestinationKind = SbpPayoutMethod;

export function detectSbpPayoutMethod(value: string): SbpPayoutMethod {
  return digitsOnly(value).length >= 12 ? "card" : "sbp";
}

export const detectSbpDestinationKind = detectSbpPayoutMethod;

export function formatSbpDestination(
  value: string,
  method: SbpPayoutMethod,
): string {
  return method === "card" ? formatCardInput(value) : formatPhoneInput(value);
}

export function validateSbpDestination(
  value: string,
  method: SbpPayoutMethod = "sbp",
): ValidationResult {
  const trimmed = value.trim();
  if (method === "card") {
    if (!trimmed) return validationError("Укажите номер карты");
    return validateCardNumber(trimmed);
  }
  if (!trimmed) return validationError("Укажите номер телефона СБП");
  return validatePhone(trimmed);
}

export function serializeSbpRequisites(
  destination: string,
  bankId: string,
  method?: SbpPayoutMethod,
  customBankName?: string,
): string {
  const bank = findSbpBank(bankId);
  const name =
    bank?.name ?? normalizeManualBankName(customBankName ?? "");
  const resolved = method ?? detectSbpPayoutMethod(destination);
  const formatted = formatSbpDestination(destination, resolved);
  const methodLabel = resolved === "card" ? METHOD_CARD : METHOD_SBP;
  if (name && formatted) {
    return `${name}${SEP}${methodLabel}${SEP}${formatted}`;
  }
  if (name) return `${name}${SEP}${methodLabel}`;
  return formatted;
}

export function parseSbpRequisites(value: string): {
  bankId: string;
  destination: string;
  method: SbpPayoutMethod;
  bankName: string;
} {
  const empty = {
    bankId: "",
    destination: "",
    method: "sbp" as SbpPayoutMethod,
    bankName: "",
  };
  const trimmed = value.trim();
  if (!trimmed) return empty;

  const fromBankLabel = (
    label: string,
    method: SbpPayoutMethod,
    destination: string,
  ) => {
    const name = normalizeManualBankName(label);
    const bank = findSbpBankByName(name);
    if (bank) {
      return { bankId: bank.id, destination, method, bankName: bank.name };
    }
    if (name) {
      return {
        bankId: SBP_MANUAL_BANK_ID,
        destination,
        method,
        bankName: name,
      };
    }
    return { ...empty, destination, method };
  };

  const parts = trimmed.split(SEP);
  if (
    parts.length >= 3 &&
    (parts[1] === METHOD_SBP || parts[1] === METHOD_CARD)
  ) {
    const method: SbpPayoutMethod =
      parts[1] === METHOD_CARD ? "card" : "sbp";
    return fromBankLabel(parts[0], method, parts.slice(2).join(SEP).trim());
  }

  const sepIdx = trimmed.indexOf(SEP);
  if (sepIdx !== -1) {
    const destination = trimmed.slice(sepIdx + SEP.length).trim();
    return fromBankLabel(
      trimmed.slice(0, sepIdx),
      detectSbpPayoutMethod(destination),
      destination,
    );
  }

  const byName = findSbpBankByName(trimmed);
  if (byName) {
    return {
      bankId: byName.id,
      destination: "",
      method: "sbp",
      bankName: byName.name,
    };
  }

  return {
    bankId: "",
    destination: trimmed,
    method: detectSbpPayoutMethod(trimmed),
    bankName: "",
  };
}

export function validateSbpRequisites(value: string): ValidationResult {
  const parsed = parseSbpRequisites(value);
  if (!parsed.bankId) {
    return validationError(
      parsed.method === "card"
        ? "Карта: выберите банк получателя"
        : "СБП: выберите банк получателя",
    );
  }
  if (isManualSbpBank(parsed.bankId) && parsed.bankName.length < 2) {
    return validationError("Введите название банка");
  }
  const destination = validateSbpDestination(parsed.destination, parsed.method);
  if (!destination.ok) {
    return validationError(destination.error);
  }
  return validationOk(
    serializeSbpRequisites(
      destination.value,
      parsed.bankId,
      parsed.method,
      parsed.bankName,
    ),
  );
}
