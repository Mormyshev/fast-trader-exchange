import { applyBuySpread, applySellSpread } from "@/src/utils/market-rates";

export type ExchangeCurrency = {
  id: string;
  name: string;
  code: string;
  /** Код для API /orders */
  orderCode: string;
  iconSrc: string;
  bybitSymbol?: string;
};

export const FIAT_CURRENCIES: ExchangeCurrency[] = [
  {
    id: "sbp",
    name: "Система быстрых платежей (СБП)",
    code: "RUB",
    orderCode: "RUB_SBP",
    iconSrc: "/icons/sbp.svg",
  },
  {
    id: "rub_cash",
    name: "Наличные RUB",
    code: "RUB",
    orderCode: "RUB_CASH",
    iconSrc: "/icons/cash.svg",
  },
  {
    id: "rub_sber",
    name: "Сбербанк RUB",
    code: "RUB",
    orderCode: "RUB_SBER",
    iconSrc: "/icons/sber.svg",
  },
  {
    id: "rub_tbank",
    name: "Т-Банк RUB",
    code: "RUB",
    orderCode: "RUB_TBANK",
    iconSrc: "/icons/tbank.svg",
  },
  {
    id: "rub_alfa",
    name: "Альфа-Банк RUB",
    code: "RUB",
    orderCode: "RUB_ALFA",
    iconSrc: "/icons/alfa.png",
  },
  {
    id: "rub_raiffeisen",
    name: "Райффайзенбанк RUB",
    code: "RUB",
    orderCode: "RUB_RAIFFEISEN",
    iconSrc: "/icons/raiffeisen.svg",
  },
];

export const CRYPTO_CURRENCIES: ExchangeCurrency[] = [
  {
    id: "usdt_trc20",
    name: "Tether TRC20 USDT",
    code: "USDT",
    orderCode: "USDT_TRC20",
    iconSrc: "/icons/usdt.svg",
    bybitSymbol: "USDTUSDT",
  },
  {
    id: "btc",
    name: "Bitcoin BTC",
    code: "BTC",
    orderCode: "BTC",
    iconSrc: "/icons/btc.svg",
    bybitSymbol: "BTCUSDT",
  },
  {
    id: "eth",
    name: "Ethereum ETH",
    code: "ETH",
    orderCode: "ETH",
    iconSrc: "/icons/eth.svg",
    bybitSymbol: "ETHUSDT",
  },
  {
    id: "ton",
    name: "Toncoin TON",
    code: "TON",
    orderCode: "TON",
    iconSrc: "/icons/ton.svg",
    bybitSymbol: "TONUSDT",
  },
  {
    id: "sol",
    name: "Solana SOL",
    code: "SOL",
    orderCode: "SOL",
    iconSrc: "/icons/sol.svg",
    bybitSymbol: "SOLUSDT",
  },
];

const ALL_CURRENCIES = [...FIAT_CURRENCIES, ...CRYPTO_CURRENCIES];

export function findCurrencyById(id: string | null | undefined): ExchangeCurrency | undefined {
  if (!id) return undefined;
  return ALL_CURRENCIES.find((c) => c.id === id);
}

export function isCryptoCurrency(currency: ExchangeCurrency): boolean {
  return CRYPTO_CURRENCIES.some((c) => c.id === currency.id);
}

export function isFiatCurrency(currency: ExchangeCurrency): boolean {
  return FIAT_CURRENCIES.some((c) => c.id === currency.id);
}

/**
 * Сколько единиц receive за 1 единицу send.
 * Buy (RUB→crypto): mid × 1.03; Sell (crypto→RUB): mid × 0.97.
 */
export function getPairRate(
  rates: Record<string, number>,
  send: ExchangeCurrency,
  receive: ExchangeCurrency,
): number {
  const mid = rates["USDTUSDT"];
  if (!(mid > 0)) return 0;

  const buyRubPerUsdt = applyBuySpread(mid);
  const sellRubPerUsdt = applySellSpread(mid);
  const sendCrypto = isCryptoCurrency(send);
  const receiveCrypto = isCryptoCurrency(receive);

  if (!sendCrypto && receiveCrypto) {
    if (receive.bybitSymbol === "USDTUSDT") return 1 / buyRubPerUsdt;
    const cryptoPriceInUsdt = rates[receive.bybitSymbol || ""] || 0;
    return cryptoPriceInUsdt > 0
      ? 1 / (cryptoPriceInUsdt * buyRubPerUsdt)
      : 0;
  }

  if (sendCrypto && !receiveCrypto) {
    if (send.bybitSymbol === "USDTUSDT") return sellRubPerUsdt;
    const cryptoPriceInUsdt = rates[send.bybitSymbol || ""] || 0;
    return cryptoPriceInUsdt > 0 ? cryptoPriceInUsdt * sellRubPerUsdt : 0;
  }

  return 0;
}

export function amountDecimals(isCrypto: boolean): number {
  return isCrypto ? 8 : 2;
}

export function formatAmount(value: number, isCrypto: boolean): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const fixed = value.toFixed(amountDecimals(isCrypto));
  if (!isCrypto) return Number(fixed).toFixed(2);
  return fixed.replace(/\.?0+$/, "") || "0";
}

function formatRubPrice(rubPerOneCrypto: number): string {
  if (!(rubPerOneCrypto > 0)) return "—";
  if (rubPerOneCrypto >= 1000) return rubPerOneCrypto.toFixed(2);
  return rubPerOneCrypto.toFixed(4);
}

/** Всегда «1» у крипты: 85.22 RUB = 1 USDT или 1 USDT = 80.25 RUB */
export function formatRateLabel(
  rate: number,
  send: ExchangeCurrency,
  receive: ExchangeCurrency,
): string {
  if (!(rate > 0)) return "Курс: загружается…";

  const sendCrypto = isCryptoCurrency(send);
  const receiveCrypto = isCryptoCurrency(receive);

  if (sendCrypto && !receiveCrypto) {
    return `Курс: 1 ${send.code} = ${formatRubPrice(rate)} ${receive.code}`;
  }

  if (!sendCrypto && receiveCrypto) {
    const rubPerCrypto = 1 / rate;
    return `Курс: ${formatRubPrice(rubPerCrypto)} ${send.code} = 1 ${receive.code}`;
  }

  return "Курс: —";
}

export function sanitizeAmountInput(raw: string): string {
  return raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
}
