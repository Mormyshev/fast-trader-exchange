export type { ValidationResult } from "./types";
export {
  validatePersonName,
  validateDocumentNumber,
  validateFio,
  validateEmail,
  validatePhone,
  normalizePhoneDigits,
  formatPhoneInput,
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
  serializeSbpRequisites,
  parseSbpRequisites,
  validateSbpRequisites,
  validateSbpDestination,
  formatSbpDestination,
  detectSbpPayoutMethod,
  detectSbpDestinationKind,
  type SbpPayoutMethod,
  type SbpDestinationKind,
} from "./sbp-payout";
export { formatCardInput, validateCardNumber } from "./card";
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
