export type { ValidationResult } from "./types";
export {
  validatePersonName,
  validateFio,
  validateEmail,
  validatePhone,
  normalizePhoneDigits,
  validateTelegram,
  formatTelegramInput,
  validateCoupon,
  validateUsername,
  validatePassword,
  validatePasswordConfirm,
  validateOperatorPseudonym,
  validateCity,
  ORDER_CITIES,
} from "./common";
export {
  orderCodeToCurrencyId,
  isCryptoOrderCode,
  formatWalletInput,
  validateCryptoWallet,
  validateFiatRequisites,
  validatePayoutDetails,
  getWalletPlaceholder,
} from "./wallet";
export {
  validateOrderFormFields,
  validateOrderFormField,
  type OrderFormInput,
  type OrderFormErrors,
} from "./order-form";
export {
  validateProfileFormFields,
  validateProfileFormField,
  type ProfileFormInput,
  type ProfileFormErrors,
} from "./profile-form";
