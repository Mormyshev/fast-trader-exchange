import type { ValidationResult } from "./types";
import {
  validateCity,
  validateCoupon,
  validateEmail,
  validateFio,
  validateTelegram,
} from "./common";
import { validatePayoutDetails } from "./wallet";

export type OrderFormInput = {
  fio: string;
  wallet: string;
  city: string;
  email: string;
  telegram: string;
  coupon: string;
  receiveCurrencyId: string;
  isReceiveCrypto: boolean;
  isCashSelected: boolean;
  requireFio: boolean;
};

export type OrderFormErrors = Partial<
  Record<"fio" | "wallet" | "city" | "email" | "telegram" | "coupon", string>
>;

export function validateOrderFormFields(
  input: OrderFormInput,
): { ok: true; values: OrderFormInput } | { ok: false; errors: OrderFormErrors } {
  const errors: OrderFormErrors = {};

  const wallet = validatePayoutDetails(
    input.wallet,
    input.receiveCurrencyId,
    input.isReceiveCrypto,
  );
  if (!wallet.ok) errors.wallet = wallet.error;

  const email = validateEmail(input.email);
  if (!email.ok) errors.email = email.error;

  const telegram = validateTelegram(input.telegram);
  if (!telegram.ok) errors.telegram = telegram.error;

  const coupon = validateCoupon(input.coupon);
  if (!coupon.ok) errors.coupon = coupon.error;

  let fioValue = input.fio;
  if (input.requireFio) {
    const fio = validateFio(input.fio);
    if (!fio.ok) errors.fio = fio.error;
    else fioValue = fio.value;
  }

  let cityValue = input.city;
  if (input.isCashSelected) {
    const city = validateCity(input.city, true);
    if (!city.ok) errors.city = city.error;
    else cityValue = city.value;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      ...input,
      wallet: wallet.ok ? wallet.value : input.wallet,
      email: email.ok ? email.value : input.email,
      telegram: telegram.ok ? telegram.value : input.telegram,
      coupon: coupon.ok ? coupon.value : input.coupon,
      fio: fioValue,
      city: cityValue,
    },
  };
}

export function validateOrderFormField(
  field: keyof OrderFormErrors,
  input: OrderFormInput,
): ValidationResult | null {
  switch (field) {
    case "wallet":
      return validatePayoutDetails(
        input.wallet,
        input.receiveCurrencyId,
        input.isReceiveCrypto,
      );
    case "email":
      return validateEmail(input.email);
    case "telegram":
      return validateTelegram(input.telegram);
    case "coupon":
      return validateCoupon(input.coupon);
    case "fio":
      return input.requireFio ? validateFio(input.fio) : null;
    case "city":
      return input.isCashSelected ? validateCity(input.city, true) : null;
    default:
      return null;
  }
}
