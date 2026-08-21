import {
  findCurrencyById,
  isCryptoCurrency,
  type ExchangeCurrency,
} from "@/src/utils/exchange-currencies";
import { formatPhoneInput } from "./common";
import { validateSbpRequisites } from "./sbp-payout";
import { validationError, validationOk, type ValidationResult } from "./types";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BTC_ADDRESS =
  /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const TON_FRIENDLY = /^(EQ|UQ)[A-Za-z0-9_-]{46}$/;

export { orderCodeToCurrencyId } from "@/src/utils/exchange-currencies";

export function isCryptoOrderCode(orderCode: string): boolean {
  return !/^RUB/i.test(orderCode);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function luhnCheck(card: string): boolean {
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

function networkLabel(currency: ExchangeCurrency | undefined): string {
  return currency?.network?.label ?? "нужной сети";
}

function detectWrongNetwork(
  address: string,
  currencyId: string,
): string | null {
  if (currencyId === "usdt_trc20") {
    if (address.startsWith("0x")) {
      return "Адрес похож на EVM (ERC20/BEP20). Для USDT TRC20 нужна сеть TRON.";
    }
    if (address.startsWith("bc1") || /^[13]/.test(address)) {
      return "Адрес похож на Bitcoin. Для USDT TRC20 нужна сеть TRON.";
    }
  }

  if (
    currencyId === "usdt_erc20" ||
    currencyId === "usdt_bep20" ||
    currencyId === "usdt_arbitrum" ||
    currencyId === "eth"
  ) {
    if (address.startsWith("T")) {
      return "Адрес похож на TRON (TRC20). Для этой сети нужен EVM-адрес 0x…";
    }
  }

  if (currencyId === "usdt_ton" || currencyId === "ton") {
    if (address.startsWith("0x")) {
      return "Адрес похож на EVM. Для TON нужен адрес EQ… или UQ…";
    }
    if (address.startsWith("T")) {
      return "Адрес похож на TRON. Для TON нужен адрес EQ… или UQ…";
    }
  }

  if (currencyId === "btc" && (address.startsWith("0x") || address.startsWith("T"))) {
    return "Адрес не относится к сети Bitcoin.";
  }

  if (currencyId === "ton" && (address.startsWith("0x") || address.startsWith("T"))) {
    return "Адрес не относится к сети TON.";
  }

  if (
    (currencyId === "sol" || currencyId === "usdt_sol") &&
    (address.startsWith("0x") || address.startsWith("T"))
  ) {
    return "Адрес не относится к сети Solana.";
  }

  return null;
}

export function formatWalletInput(value: string, currencyId: string): string {
  if (currencyId === "sbp") {
    return formatPhoneInput(value);
  }
  if (currencyId === "usdt_trc20") {
    if (value === "") return "";
    const cleaned = value.replace(/\s/g, "");
    if (!cleaned.startsWith("T")) {
      return `T${cleaned.replace(/^T*/i, "")}`;
    }
    return cleaned;
  }
  if (
    currencyId === "eth" ||
    currencyId === "usdt_erc20" ||
    currencyId === "usdt_bep20" ||
    currencyId === "usdt_arbitrum"
  ) {
    const cleaned = value.replace(/\s/g, "");
    if (!cleaned) return "";
    if (cleaned.startsWith("0x") || cleaned.startsWith("0X")) {
      return `0x${cleaned.slice(2).replace(/[^a-fA-F0-9]/g, "")}`;
    }
    return `0x${cleaned.replace(/[^a-fA-F0-9]/g, "")}`;
  }
  return value.trim();
}

export function validateCryptoWallet(
  value: string,
  currencyId: string,
): ValidationResult {
  const currency = findCurrencyById(currencyId);
  const trimmed = value.trim().replace(/\s/g, "");
  const network = networkLabel(currency);

  if (!trimmed) {
    return validationError(`Укажите адрес кошелька (${network})`);
  }

  const wrongNetwork = detectWrongNetwork(trimmed, currencyId);
  if (wrongNetwork) {
    return validationError(wrongNetwork);
  }

  switch (currencyId) {
    case "usdt_trc20":
      if (!TRON_ADDRESS.test(trimmed)) {
        return validationError(
          `USDT TRC20: адрес TRON начинается с T, ровно 34 символа (${network})`,
        );
      }
      break;
    case "usdt_erc20":
      if (!ETH_ADDRESS.test(trimmed)) {
        return validationError(
          `USDT ERC20: адрес Ethereum — 0x и 40 hex-символов (${network})`,
        );
      }
      break;
    case "usdt_bep20":
      if (!ETH_ADDRESS.test(trimmed)) {
        return validationError(
          `USDT BEP20: адрес BSC — 0x и 40 hex-символов (${network})`,
        );
      }
      break;
    case "usdt_ton":
      if (!TON_FRIENDLY.test(trimmed)) {
        return validationError(
          `USDT TON: адрес Jetton — EQ или UQ (${network})`,
        );
      }
      break;
    case "usdt_sol":
      if (!BASE58.test(trimmed) || trimmed.length < 32 || trimmed.length > 44) {
        return validationError(
          `USDT SOL: адрес Solana — Base58, 32–44 символа (${network})`,
        );
      }
      break;
    case "usdt_arbitrum":
      if (!ETH_ADDRESS.test(trimmed)) {
        return validationError(
          `USDT Arbitrum One: адрес — 0x и 40 hex-символов (${network})`,
        );
      }
      break;
    case "btc":
      if (!BTC_ADDRESS.test(trimmed)) {
        return validationError(
          `BTC: укажите адрес сети Bitcoin (bc1…, 1… или 3…)`,
        );
      }
      break;
    case "eth":
      if (!ETH_ADDRESS.test(trimmed)) {
        return validationError(
          `ETH: адрес Ethereum — 0x и 40 hex-символов (${network})`,
        );
      }
      break;
    case "ton":
      if (!TON_FRIENDLY.test(trimmed)) {
        return validationError(
          `TON: адрес сети TON начинается с EQ или UQ (${network})`,
        );
      }
      break;
    case "sol":
      if (!BASE58.test(trimmed) || trimmed.length < 32 || trimmed.length > 44) {
        return validationError(
          `SOL: адрес Solana — Base58, 32–44 символа (${network})`,
        );
      }
      break;
    default:
      if (trimmed.length < 10 || trimmed.length > 128) {
        return validationError(`Некорректный адрес кошелька (${network})`);
      }
  }

  return validationOk(trimmed);
}

export function validateFiatRequisites(
  value: string,
  currencyId: string,
): ValidationResult {
  const currency = findCurrencyById(currencyId);
  const channel = currency?.network?.label ?? "реквизиты";
  const trimmed = value.trim();

  if (!trimmed) {
    return validationError(`Укажите реквизиты для получения (${channel})`);
  }

  const digits = digitsOnly(trimmed);

  if (currencyId === "sbp") {
    return validateSbpRequisites(trimmed);
  }

  if (currencyId === "rub_cash") {
    return validationOk(trimmed);
  }

  if (digits.length >= 16 && digits.length <= 19) {
    if (!luhnCheck(digits)) {
      return validationError(`Некорректный номер карты (${channel})`);
    }
    return validationOk(digits.replace(/(.{4})/g, "$1 ").trim());
  }

  if (digits.length === 20) {
    return validationOk(digits);
  }

  return validationError(
    `${channel}: номер карты (16–19 цифр) или расчётный счёт (20 цифр)`,
  );
}

export function validatePayoutDetails(
  value: string,
  currencyId: string,
  isCrypto?: boolean,
): ValidationResult {
  const currency = findCurrencyById(currencyId);
  const crypto = isCrypto ?? (currency ? isCryptoCurrency(currency) : false);

  return crypto
    ? validateCryptoWallet(value, currencyId)
    : validateFiatRequisites(value, currencyId);
}

export function getWalletPlaceholder(currencyId: string): string {
  const currency = findCurrencyById(currencyId);
  return currency?.network?.addressHint ?? "Адрес или реквизиты";
}
