import { applyBuySpread, applySellSpread } from "@/src/utils/market-rates";

export type CurrencyNetwork = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  addressHint: string;
};

export type CryptoNetworkVariant = {
  id: string;
  orderCode: string;
  network: CurrencyNetwork;
};

export type CryptoAsset = {
  id: string;
  name: string;
  code: string;
  iconSrc: string;
  bybitSymbol?: string;
  networks: CryptoNetworkVariant[];
};

export type ExchangeCurrency = {
  id: string;
  name: string;
  code: string;
  /** Код для API /orders */
  orderCode: string;
  iconSrc: string;
  bybitSymbol?: string;
  network?: CurrencyNetwork;
  /** ID группы актива (usdt, btc, …) */
  assetId?: string;
};

export const FIAT_CURRENCIES: ExchangeCurrency[] = [
  {
    id: "sbp",
    name: "Система быстрых платежей (СБП)",
    code: "RUB",
    orderCode: "RUB_SBP",
    iconSrc: "/icons/sbp.svg",
    network: {
      id: "sbp",
      label: "Система быстрых платежей",
      shortLabel: "СБП",
      description: "Выплата через СБП на номер телефона получателя.",
      addressHint: "+7 (999) 000-00-00",
    },
  },
  {
    id: "rub_sber",
    name: "Сбербанк RUB",
    code: "RUB",
    orderCode: "RUB_SBER",
    iconSrc: "/icons/sber.svg",
    network: {
      id: "sber",
      label: "Сбербанк",
      shortLabel: "Сбербанк",
      description: "Перевод на карту или счёт Сбербанка.",
      addressHint: "Номер карты или счёта",
    },
  },
  {
    id: "rub_tbank",
    name: "Т-Банк RUB",
    code: "RUB",
    orderCode: "RUB_TBANK",
    iconSrc: "/icons/tbank.svg",
    network: {
      id: "tbank",
      label: "Т-Банк",
      shortLabel: "Т-Банк",
      description: "Перевод на карту или счёт Т-Банка.",
      addressHint: "Номер карты или счёта",
    },
  },
  {
    id: "rub_alfa",
    name: "Альфа-Банк RUB",
    code: "RUB",
    orderCode: "RUB_ALFA",
    iconSrc: "/icons/alfa.png",
    network: {
      id: "alfa",
      label: "Альфа-Банк",
      shortLabel: "Альфа-Банк",
      description: "Перевод на карту или счёт Альфа-Банка.",
      addressHint: "Номер карты или счёта",
    },
  },
  {
    id: "rub_raiffeisen",
    name: "Райффайзенбанк RUB",
    code: "RUB",
    orderCode: "RUB_RAIFFEISEN",
    iconSrc: "/icons/raiffeisen.svg",
    network: {
      id: "raiffeisen",
      label: "Райффайзенбанк",
      shortLabel: "Райффайзен",
      description: "Перевод на карту или счёт Райффайзенбанка.",
      addressHint: "Номер карты или счёта",
    },
  },
];

export const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    id: "usdt",
    name: "Tether USDT",
    code: "USDT",
    iconSrc: "/icons/usdt.svg",
    bybitSymbol: "USDTUSDT",
    networks: [
      {
        id: "usdt_trc20",
        orderCode: "USDT_TRC20",
        network: {
          id: "tron-trc20",
          label: "TRON (TRC20)",
          shortLabel: "TRC20",
          description:
            "USDT в сети TRON. Не используйте ERC20, BEP20 и другие сети.",
          addressHint: "T… (34 символа, TRON)",
        },
      },
      {
        id: "usdt_erc20",
        orderCode: "USDT_ERC20",
        network: {
          id: "ethereum-erc20",
          label: "Ethereum (ERC20)",
          shortLabel: "ERC20",
          description:
            "USDT в сети Ethereum (ERC20). Не используйте TRON (TRC20) или BSC (BEP20).",
          addressHint: "0x… (42 символа, Ethereum)",
        },
      },
      {
        id: "usdt_bep20",
        orderCode: "USDT_BEP20",
        network: {
          id: "bsc-bep20",
          label: "BNB Smart Chain (BEP20)",
          shortLabel: "BEP20",
          description:
            "USDT в сети BNB Smart Chain (BEP20). Не используйте TRON или Ethereum.",
          addressHint: "0x… (42 символа, BSC)",
        },
      },
      {
        id: "usdt_ton",
        orderCode: "USDT_TON",
        network: {
          id: "ton-jetton",
          label: "TON (Jetton)",
          shortLabel: "TON",
          description:
            "USDT в сети TON (Jetton). Не используйте TRON, Ethereum или BSC.",
          addressHint: "EQ… или UQ… (сеть TON)",
        },
      },
      {
        id: "usdt_sol",
        orderCode: "USDT_SOL",
        network: {
          id: "solana-spl",
          label: "Solana (SPL)",
          shortLabel: "SOL",
          description:
            "USDT в сети Solana (SPL). Не используйте TRON, Ethereum, BSC или TON.",
          addressHint: "Base58, 32–44 символа (Solana)",
        },
      },
      {
        id: "usdt_arbitrum",
        orderCode: "USDT_ARBITRUM",
        network: {
          id: "arbitrum-one",
          label: "Arbitrum One",
          shortLabel: "ARB1",
          description:
            "USDT в сети Arbitrum One. Не используйте Ethereum (ERC20), BSC (BEP20) или TRON.",
          addressHint: "0x… (42 символа, Arbitrum One)",
        },
      },
    ],
  },
  {
    id: "btc",
    name: "Bitcoin BTC",
    code: "BTC",
    iconSrc: "/icons/btc.svg",
    bybitSymbol: "BTCUSDT",
    networks: [
      {
        id: "btc",
        orderCode: "BTC",
        network: {
          id: "bitcoin",
          label: "Bitcoin",
          shortLabel: "BTC",
          description: "Перевод в основной сети Bitcoin (BTC).",
          addressHint: "bc1…, 1… или 3…",
        },
      },
    ],
  },
  {
    id: "eth",
    name: "Ethereum ETH",
    code: "ETH",
    iconSrc: "/icons/eth.svg",
    bybitSymbol: "ETHUSDT",
    networks: [
      {
        id: "eth",
        orderCode: "ETH",
        network: {
          id: "ethereum",
          label: "Ethereum",
          shortLabel: "ETH",
          description:
            "Нативный ETH в сети Ethereum. Не используйте BSC, Polygon и другие EVM-сети.",
          addressHint: "0x… (42 символа, Ethereum)",
        },
      },
    ],
  },
  {
    id: "ton",
    name: "Toncoin TON",
    code: "TON",
    iconSrc: "/icons/ton.svg",
    bybitSymbol: "TONUSDT",
    networks: [
      {
        id: "ton",
        orderCode: "TON",
        network: {
          id: "ton",
          label: "TON",
          shortLabel: "TON",
          description: "Перевод в сети The Open Network (TON).",
          addressHint: "EQ… или UQ…",
        },
      },
    ],
  },
  {
    id: "sol",
    name: "Solana SOL",
    code: "SOL",
    iconSrc: "/icons/sol.svg",
    bybitSymbol: "SOLUSDT",
    networks: [
      {
        id: "sol",
        orderCode: "SOL",
        network: {
          id: "solana",
          label: "Solana",
          shortLabel: "SOL",
          description: "Перевод в сети Solana (SPL).",
          addressHint: "Base58, 32–44 символа",
        },
      },
    ],
  },
];

function variantToCurrency(
  asset: CryptoAsset,
  variant: CryptoNetworkVariant,
): ExchangeCurrency {
  return {
    id: variant.id,
    assetId: asset.id,
    name: asset.name,
    code: asset.code,
    orderCode: variant.orderCode,
    iconSrc: asset.iconSrc,
    bybitSymbol: asset.bybitSymbol,
    network: variant.network,
  };
}

export const CRYPTO_CURRENCIES: ExchangeCurrency[] = CRYPTO_ASSETS.flatMap(
  (asset) => asset.networks.map((variant) => variantToCurrency(asset, variant)),
);

const ALL_CURRENCIES = [...FIAT_CURRENCIES, ...CRYPTO_CURRENCIES];

export function findCurrencyById(id: string | null | undefined): ExchangeCurrency | undefined {
  if (!id) return undefined;
  const direct = ALL_CURRENCIES.find((c) => c.id === id);
  if (direct) return direct;
  return resolveCurrencyVariant(id);
}

export function findCryptoAsset(
  assetId: string | null | undefined,
): CryptoAsset | undefined {
  if (!assetId) return undefined;
  return CRYPTO_ASSETS.find((asset) => asset.id === assetId);
}

export function getAssetForCurrency(
  currency: ExchangeCurrency,
): CryptoAsset | undefined {
  if (currency.assetId) return findCryptoAsset(currency.assetId);
  return CRYPTO_ASSETS.find((asset) =>
    asset.networks.some((variant) => variant.id === currency.id),
  );
}

export function hasNetworkChoice(asset: CryptoAsset): boolean {
  return asset.networks.length > 1;
}

export function resolveCurrencyVariant(
  assetId: string,
  variantId?: string | null,
): ExchangeCurrency | undefined {
  const asset = findCryptoAsset(assetId);
  if (!asset) return undefined;

  const variant = variantId
    ? asset.networks.find((item) => item.id === variantId)
    : asset.networks[0];

  if (!variant) return undefined;
  return variantToCurrency(asset, variant);
}

export function getDefaultCryptoCurrency(
  assetId: string = CRYPTO_ASSETS[0]?.id ?? "usdt",
): ExchangeCurrency {
  return resolveCurrencyVariant(assetId) ?? CRYPTO_CURRENCIES[0];
}

export function findCurrencyByOrderCode(
  orderCode: string | null | undefined,
): ExchangeCurrency | undefined {
  if (!orderCode) return undefined;
  return ALL_CURRENCIES.find((c) => c.orderCode === orderCode);
}

export function orderCodeToCurrencyId(orderCode: string): string {
  return findCurrencyByOrderCode(orderCode)?.id ?? orderCode.toLowerCase();
}

export function isCryptoCurrency(currency: ExchangeCurrency): boolean {
  return (
    !!currency.assetId ||
    CRYPTO_CURRENCIES.some((item) => item.id === currency.id)
  );
}

export function isFiatCurrency(currency: ExchangeCurrency): boolean {
  return FIAT_CURRENCIES.some((c) => c.id === currency.id);
}

/** Клиент получает рубли (оператор выплачивает RUB) */
export function isRubPayout(currencyTo: string | null | undefined): boolean {
  if (!currencyTo) return false;
  return /RUB/i.test(currencyTo);
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
    if (receive.code === "USDT") return 1 / buyRubPerUsdt;
    const cryptoPriceInUsdt = rates[receive.bybitSymbol || ""] || 0;
    return cryptoPriceInUsdt > 0
      ? 1 / (cryptoPriceInUsdt * buyRubPerUsdt)
      : 0;
  }

  if (sendCrypto && !receiveCrypto) {
    if (send.code === "USDT") return sellRubPerUsdt;
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
