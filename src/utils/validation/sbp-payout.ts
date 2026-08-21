import { findSbpBank, findSbpBankByName } from "@/src/utils/banks/sbp-banks";
import { formatPhoneInput, validatePhone } from "./common";
import { validationError, validationOk, type ValidationResult } from "./types";

const SEP = " · ";

export function serializeSbpRequisites(phone: string, bankId: string): string {
  const bank = findSbpBank(bankId);
  const formattedPhone = formatPhoneInput(phone);
  if (bank && formattedPhone) return `${bank.name}${SEP}${formattedPhone}`;
  if (bank) return bank.name;
  return formattedPhone;
}

export function parseSbpRequisites(value: string): {
  bankId: string;
  phone: string;
} {
  const trimmed = value.trim();
  if (!trimmed) return { bankId: "", phone: "" };

  const sepIdx = trimmed.indexOf(SEP);
  if (sepIdx !== -1) {
    const bank = findSbpBankByName(trimmed.slice(0, sepIdx));
    return {
      bankId: bank?.id ?? "",
      phone: trimmed.slice(sepIdx + SEP.length).trim(),
    };
  }

  const byName = findSbpBankByName(trimmed);
  if (byName) return { bankId: byName.id, phone: "" };

  return { bankId: "", phone: trimmed };
}

export function validateSbpRequisites(value: string): ValidationResult {
  const parsed = parseSbpRequisites(value);
  if (!parsed.bankId) {
    return validationError("СБП: выберите банк получателя");
  }
  const phone = validatePhone(parsed.phone);
  if (!phone.ok) {
    return validationError("СБП: укажите номер телефона +7 (XXX) XXX-XX-XX");
  }
  return validationOk(serializeSbpRequisites(parsed.phone, parsed.bankId));
}
