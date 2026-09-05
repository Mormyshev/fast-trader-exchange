import { findSbpBank, findSbpBankByName } from "@/src/utils/banks/sbp-banks";
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
): string {
  const bank = findSbpBank(bankId);
  const resolved = method ?? detectSbpPayoutMethod(destination);
  const formatted = formatSbpDestination(destination, resolved);
  const methodLabel = resolved === "card" ? METHOD_CARD : METHOD_SBP;
  if (bank && formatted) {
    return `${bank.name}${SEP}${methodLabel}${SEP}${formatted}`;
  }
  if (bank) return `${bank.name}${SEP}${methodLabel}`;
  return formatted;
}

export function parseSbpRequisites(value: string): {
  bankId: string;
  destination: string;
  method: SbpPayoutMethod;
} {
  const trimmed = value.trim();
  if (!trimmed) return { bankId: "", destination: "", method: "sbp" };

  const parts = trimmed.split(SEP);
  if (
    parts.length >= 3 &&
    (parts[1] === METHOD_SBP || parts[1] === METHOD_CARD)
  ) {
    const bank = findSbpBankByName(parts[0]);
    const method: SbpPayoutMethod =
      parts[1] === METHOD_CARD ? "card" : "sbp";
    return {
      bankId: bank?.id ?? "",
      method,
      destination: parts.slice(2).join(SEP).trim(),
    };
  }

  const sepIdx = trimmed.indexOf(SEP);
  if (sepIdx !== -1) {
    const bank = findSbpBankByName(trimmed.slice(0, sepIdx));
    const destination = trimmed.slice(sepIdx + SEP.length).trim();
    return {
      bankId: bank?.id ?? "",
      destination,
      method: detectSbpPayoutMethod(destination),
    };
  }

  const byName = findSbpBankByName(trimmed);
  if (byName) return { bankId: byName.id, destination: "", method: "sbp" };

  return {
    bankId: "",
    destination: trimmed,
    method: detectSbpPayoutMethod(trimmed),
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
  const destination = validateSbpDestination(parsed.destination, parsed.method);
  if (!destination.ok) {
    return validationError(
      parsed.method === "card"
        ? "Карта: укажите номер карты (16–19 цифр)"
        : "СБП: укажите телефон +7 (XXX) XXX-XX-XX",
    );
  }
  return validationOk(
    serializeSbpRequisites(destination.value, parsed.bankId, parsed.method),
  );
}
