import { validationError, validationOk, type ValidationResult } from "./types";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function luhnCheck(card: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = card.length - 1; i >= 0; i -= 1) {
    let n = Number(card[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Маска ввода: 2202 2002 1234 5678 */
export function formatCardInput(value: string): string {
  const digits = digitsOnly(value).slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function validateCardNumber(value: string): ValidationResult {
  const digits = digitsOnly(value);
  if (!digits) {
    return validationError("Укажите номер карты");
  }
  if (digits.length < 16 || digits.length > 19) {
    return validationError("Номер карты: 16–19 цифр");
  }
  if (!luhnCheck(digits)) {
    return validationError("Некорректный номер карты");
  }
  return validationOk(formatCardInput(digits));
}
