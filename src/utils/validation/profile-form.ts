import type { ValidationResult } from "./types";
import {
  validateDocumentNumber,
  validatePersonName,
  validatePhone,
  validateTelegram,
} from "./common";

export type ProfileFormInput = {
  lastName: string;
  firstName: string;
  middleName: string;
  documentNumber: string;
  phone: string;
  telegram: string;
};

export type ProfileFormErrors = Partial<
  Record<
    | "lastName"
    | "firstName"
    | "middleName"
    | "documentNumber"
    | "phone"
    | "telegram"
    | "passport"
    | "selfie",
    string
  >
>;

export function validateProfileFormFields(
  input: ProfileFormInput,
  options?: { hasPassport: boolean; hasSelfie?: boolean },
):
  | { ok: true; values: ProfileFormInput }
  | { ok: false; errors: ProfileFormErrors } {
  const errors: ProfileFormErrors = {};

  const lastName = validatePersonName(input.lastName, "Фамилия");
  if (!lastName.ok) errors.lastName = lastName.error;

  const firstName = validatePersonName(input.firstName, "Имя");
  if (!firstName.ok) errors.firstName = firstName.error;

  const middleName = validatePersonName(input.middleName, "Отчество");
  if (!middleName.ok) errors.middleName = middleName.error;

  const documentNumber = validateDocumentNumber(input.documentNumber);
  if (!documentNumber.ok) errors.documentNumber = documentNumber.error;

  const phone = validatePhone(input.phone);
  if (!phone.ok) errors.phone = phone.error;

  const telegram = validateTelegram(input.telegram);
  if (!telegram.ok) errors.telegram = telegram.error;

  if (options?.hasPassport === false) {
    errors.passport = "Загрузите фото документа";
  }
  if (options?.hasSelfie === false) {
    errors.selfie = "Загрузите селфи с документом";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      lastName: lastName.ok ? lastName.value : input.lastName,
      firstName: firstName.ok ? firstName.value : input.firstName,
      middleName: middleName.ok ? middleName.value : input.middleName,
      documentNumber: documentNumber.ok
        ? documentNumber.value
        : input.documentNumber,
      phone: phone.ok ? phone.value : input.phone,
      telegram: telegram.ok ? telegram.value : input.telegram,
    },
  };
}

export function validateProfileFormField(
  field: Exclude<keyof ProfileFormErrors, "passport" | "selfie">,
  input: ProfileFormInput,
): ValidationResult | null {
  switch (field) {
    case "lastName":
      return validatePersonName(input.lastName, "Фамилия");
    case "firstName":
      return validatePersonName(input.firstName, "Имя");
    case "middleName":
      return validatePersonName(input.middleName, "Отчество");
    case "documentNumber":
      return validateDocumentNumber(input.documentNumber);
    case "phone":
      return validatePhone(input.phone);
    case "telegram":
      return validateTelegram(input.telegram);
    default:
      return null;
  }
}
