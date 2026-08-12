import { validationError, validationOk, type ValidationResult } from "./types";

const CYRILLIC_NAME = /^[А-Яа-яЁё-]+$/;
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const TELEGRAM_RE = /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const COUPON_RE = /^[a-zA-Z0-9_-]{0,32}$/;

export function validatePersonName(
  value: string,
  label: string,
  required = true,
): ValidationResult {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return required
      ? validationError(`Укажите ${label.toLowerCase()}`)
      : validationOk("");
  }
  if (trimmed.length < 2 || trimmed.length > 64) {
    return validationError(`${label}: от 2 до 64 символов`);
  }
  if (!CYRILLIC_NAME.test(trimmed)) {
    return validationError(`${label}: только кириллица и дефис`);
  }
  return validationOk(trimmed);
}

export function validateFio(value: string): ValidationResult {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return validationError("Укажите ФИО");
  }
  const parts = trimmed.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return validationError("ФИО: укажите минимум фамилию и имя");
  }
  if (parts.length > 4) {
    return validationError("ФИО: слишком много частей");
  }
  for (const part of parts) {
    if (!CYRILLIC_NAME.test(part) || part.length < 2) {
      return validationError("ФИО: каждая часть — кириллица, от 2 символов");
    }
  }
  return validationOk(trimmed);
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return validationError("Укажите e-mail");
  }
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
    return validationError("Некорректный e-mail");
  }
  return validationOk(trimmed);
}

export function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `7${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return digits;
  }
  return digits;
}

export function validatePhone(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return validationError("Укажите телефон");
  }
  const digits = normalizePhoneDigits(trimmed);
  if (digits.length !== 11 || !digits.startsWith("7")) {
    return validationError("Телефон: формат +7 (XXX) XXX-XX-XX");
  }
  return validationOk(`+${digits}`);
}

export function formatTelegramInput(value: string): string {
  if (value === "") return "";
  const cleaned = value.replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "");
  if (!cleaned) return "@";
  return `@${cleaned}`;
}

export function validateTelegram(value: string): ValidationResult {
  const trimmed = formatTelegramInput(value.trim());
  if (!trimmed || trimmed === "@") {
    return validationError("Укажите Telegram");
  }
  if (!TELEGRAM_RE.test(trimmed)) {
    return validationError("Telegram: @username, 5–32 символа (латиница, цифры, _)");
  }
  return validationOk(trimmed);
}

export function validateCoupon(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return validationOk("");
  if (!COUPON_RE.test(trimmed)) {
    return validationError("Купон: только латиница, цифры, _ и -");
  }
  return validationOk(trimmed.toUpperCase());
}

export function validateUsername(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return validationError("Укажите логин");
  }
  if (!USERNAME_RE.test(trimmed)) {
    return validationError("Логин: 3–32 символа, латиница, цифры и _");
  }
  return validationOk(trimmed);
}

export function validatePassword(value: string): ValidationResult {
  const trimmed = value;
  if (!trimmed) {
    return validationError("Укажите пароль");
  }
  if (trimmed.length < 8) {
    return validationError("Пароль: минимум 8 символов");
  }
  if (trimmed.length > 72) {
    return validationError("Пароль: слишком длинный");
  }
  return validationOk(trimmed);
}

export function validatePasswordConfirm(
  password: string,
  confirm: string,
): ValidationResult {
  if (!confirm) {
    return validationError("Подтвердите пароль");
  }
  if (password !== confirm) {
    return validationError("Пароли не совпадают");
  }
  return validationOk(confirm);
}

export function validateOperatorPseudonym(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return validationError("Укажите псевдоним");
  }
  if (trimmed.length > 40) {
    return validationError("Псевдоним: до 40 символов");
  }
  if (!/^[А-Яа-яЁёA-Za-z0-9\s.-]{2,40}$/.test(trimmed)) {
    return validationError("Псевдоним: буквы, цифры, пробел, . и -");
  }
  return validationOk(trimmed);
}

export const ORDER_CITIES = ["Москва", "Санкт-Петербург", "Новосибирск"] as const;

export function validateCity(value: string, required: boolean): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? validationError("Выберите город") : validationOk("");
  }
  if (!ORDER_CITIES.includes(trimmed as (typeof ORDER_CITIES)[number])) {
    return validationError("Выберите город из списка");
  }
  return validationOk(trimmed);
}
