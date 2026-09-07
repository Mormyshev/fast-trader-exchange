import axios from "axios";

/** Клиент покупает крипту: к курсу ЦБ +5 ₽ за 1 USDT */
export const CLIENT_BUY_MARKUP_RUB = 5;
/** Клиент продаёт крипту: от курса ЦБ −2 ₽ за 1 USDT */
export const CLIENT_SELL_MARKDOWN_RUB = 2;

const CBR_JSON_MIRROR = "https://www.cbr-xml-daily.ru/daily_json.js";
const RAPIRA_RATES_URL = "https://api.rapira.net/open/market/rates";
const BYBIT_TICKERS_URL = "https://api.bybit.com/v5/market/tickers";
const BINANCE_PRICE_URL = "https://api.binance.com/api/v3/ticker/price";

export type MarketRates = {
  /** Mid: сколько RUB за 1 USDT */
  USDTUSDT: number;
  BTCUSDT: number;
  ETHUSDT: number;
  TONUSDT: number;
  SOLUSDT: number;
  source: string;
  /** Источник по символу API: USDTUSDT, BTCUSDT, … */
  sources: Record<string, string>;
  /** ЦБ и зеркало недоступны */
  cbrOffline: boolean;
};

export type RateRow = {
  symbol: keyof Omit<MarketRates, "source" | "sources" | "cbrOffline"> | string;
  base_price: number;
  exchange_price: number;
  updated_at: string;
};

export const PUBLIC_RATE_SYMBOLS = [
  "USDTUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "TONUSDT",
] as const;

/** Последний успешный официальный USD/RUB ЦБ */
export const USDT_CBR_LAST_SYMBOL = "USDTUSDT_CBR_LAST";
/** Резервный курс, заданный админом */
export const USDT_MANUAL_SYMBOL = "USDTUSDT_MANUAL";
export const CBR_LAST_SOURCE = "последний курс ЦБ РФ";
export const CBR_MANUAL_SOURCE = "задан админом";

export const SUPABASE_RATES_CACHE_SOURCE =
  "кэш Supabase (таблица crypto_rates)";

export function shortRateSource(raw: string | undefined): string {
  if (!raw) return "неизвестно";
  if (raw.includes("задан админом")) return "задан админом";
  if (raw.includes("последний курс ЦБ")) return "последний курс ЦБ";
  if (raw.includes("ЦБ РФ")) return "ЦБ РФ";
  if (raw.includes("зеркало ЦБ")) return "зеркало ЦБ";
  if (raw.includes("Rapira")) return "Rapira";
  if (raw.includes("Bybit")) return "Bybit";
  if (raw.includes("Binance")) return "Binance";
  if (raw.includes("кэш") || raw.includes("Supabase")) return "кэш БД";
  if (raw.includes("fallback") || raw.includes("захардкожен")) {
    return "запасное значение";
  }
  return raw;
}

export function rateSourceDetail(raw: string | undefined): string {
  if (!raw) return "";
  const open = raw.indexOf("(");
  const close = raw.lastIndexOf(")");
  if (open >= 0 && close > open) {
    return raw.slice(open + 1, close).trim();
  }
  return raw;
}

const RAPIRA_VERIFY_PAIR: Record<string, string> = {
  USDTUSDT: "USDT_RUB",
  BTCUSDT: "BTC_USDT",
  ETHUSDT: "ETH_USDT",
  SOLUSDT: "SOL_USDT",
  TONUSDT: "TON_USDT",
};

const BYBIT_VERIFY_PAIR: Record<string, string> = {
  BTCUSDT: "BTC/USDT",
  ETHUSDT: "ETH/USDT",
  SOLUSDT: "SOL/USDT",
  TONUSDT: "TON/USDT",
};

/** Публичная страница, где можно глазами сверить курс (не API). */
export function rateSourceVerifyUrl(
  raw: string | undefined,
  symbol: string,
): string | null {
  if (!raw) return null;
  if (raw.includes("задан админом")) return null;
  if (raw.includes("последний курс ЦБ") || raw.includes("ЦБ РФ")) {
    return "https://www.cbr.ru/currency_base/daily/";
  }
  if (raw.includes("зеркало ЦБ")) {
    return "https://www.cbr-xml-daily.ru/";
  }
  if (raw.includes("Rapira")) {
    const pair = RAPIRA_VERIFY_PAIR[symbol] ?? "USDT_RUB";
    return `https://rapira.net/exchange/${pair}`;
  }
  if (raw.includes("Bybit")) {
    const pair = BYBIT_VERIFY_PAIR[symbol];
    return pair
      ? `https://www.bybit.com/trade/spot/${pair}`
      : "https://www.bybit.com/trade/spot";
  }
  if (raw.includes("Binance")) {
    const base = symbol.replace(/USDT$/, "") || "TON";
    return `https://www.binance.com/en/trade/${base}_USDT`;
  }
  return null;
}

/** Курс покупки крипты за RUB (клиент платит ЦБ + 5 ₽ за USDT) */
export function applyBuySpread(midRubPerUsdt: number): number {
  return midRubPerUsdt + CLIENT_BUY_MARKUP_RUB;
}

/** Курс продажи крипты за RUB (клиент получает ЦБ − 2 ₽ за USDT) */
export function applySellSpread(midRubPerUsdt: number): number {
  const next = midRubPerUsdt - CLIENT_SELL_MARKDOWN_RUB;
  return next > 0 ? next : midRubPerUsdt;
}

type StoredRate = { symbol: string; exchange_price: number };

function storedRate(rows: StoredRate[], symbol: string): number {
  const value = rows.find((row) => row.symbol === symbol)?.exchange_price;
  return value && value > 0 ? value : 0;
}

/** Если ЦБ недоступен: ручной курс админа, иначе последний успешный ЦБ. */
export function resolveOfflineUsdt(rows: StoredRate[]): {
  rate: number;
  source: string;
} {
  const manual = storedRate(rows, USDT_MANUAL_SYMBOL);
  if (manual) return { rate: manual, source: CBR_MANUAL_SOURCE };
  const last =
    storedRate(rows, USDT_CBR_LAST_SYMBOL) || storedRate(rows, "USDTUSDT");
  return { rate: last, source: CBR_LAST_SOURCE };
}

export function applyUsdtFallback(
  rates: MarketRates,
  rows: StoredRate[],
): MarketRates {
  if (!rates.cbrOffline) return rates;
  const fallback = resolveOfflineUsdt(rows);
  return {
    ...rates,
    USDTUSDT: fallback.rate,
    sources: { ...rates.sources, USDTUSDT: fallback.source },
  };
}

function rateUpsert(symbol: string, price: number, updated_at: string): RateRow {
  return {
    symbol,
    base_price: price,
    exchange_price: price,
    updated_at,
  };
}

type RapiraRate = {
  symbol: string;
  close?: number;
  askPrice?: number;
  bidPrice?: number;
};

function midFromRapira(row: RapiraRate | undefined): number | null {
  if (!row) return null;
  const ask = Number(row.askPrice);
  const bid = Number(row.bidPrice);
  if (Number.isFinite(ask) && Number.isFinite(bid) && ask > 0 && bid > 0) {
    return (ask + bid) / 2;
  }
  const close = Number(row.close);
  return Number.isFinite(close) && close > 0 ? close : null;
}

function parseCbrNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  return Number(raw.replace(/\s/g, "").replace(",", "."));
}

/** Официальный курс ЦБ: рублей за 1 USD (USDT считаем как USD). */
function parseCbrRubPerUsd(xml: string): number | null {
  const block = xml.split(/<\/Valute>/i).find((part) =>
    /<CharCode>\s*USD\s*<\/CharCode>/i.test(part),
  );
  if (!block) return null;

  const nominal = parseCbrNumber(block.match(/<Nominal>([\d\s]+)<\/Nominal>/i)?.[1]);
  const value = parseCbrNumber(block.match(/<Value>([\d\s,]+)<\/Value>/i)?.[1]);
  if (!(nominal > 0) || !(value > 0)) return null;
  return value / nominal;
}

function moscowDateReq(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  return `${day}/${month}/${year}`;
}

async function fetchCbrXml(url: string): Promise<number | null> {
  const res = await axios.get(url, {
    timeout: 8000,
    signal: AbortSignal.timeout(8000),
    responseType: "text",
    headers: {
      Accept: "application/xml, text/xml, */*",
      "User-Agent": "FastTraderExchange/1.0",
    },
  });
  const xml = typeof res.data === "string" ? res.data : String(res.data ?? "");
  const rate = parseCbrRubPerUsd(xml);
  return rate && rate > 0 ? Number(rate.toFixed(4)) : null;
}

async function fetchCbrJsonMirror(): Promise<number | null> {
  const res = await axios.get(CBR_JSON_MIRROR, {
    timeout: 8000,
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  const usd = res.data?.Valute?.USD;
  const nominal = Number(usd?.Nominal);
  const value = Number(usd?.Value);
  if (!(nominal > 0) || !(value > 0)) return null;
  return Number((value / nominal).toFixed(4));
}

type RateHit = { rate: number; source: string };

/** Официальный USD/RUB ЦБ РФ. USDT на сайте считается по этому курсу, без спреда. */
export async function fetchCbrUsdRubHit(): Promise<RateHit | null> {
  const dated = `https://www.cbr.ru/scripts/XML_daily.asp?date_req=${encodeURIComponent(moscowDateReq())}`;
  const latest = "https://www.cbr.ru/scripts/XML_daily.asp";

  for (const url of [dated, latest]) {
    try {
      const rate = await fetchCbrXml(url);
      if (rate) return { rate, source: `ЦБ РФ (${url})` };
    } catch {
      // следующий источник ЦБ
    }
  }

  try {
    const rate = await fetchCbrJsonMirror();
    if (rate) return { rate, source: `зеркало ЦБ (${CBR_JSON_MIRROR})` };
  } catch {
    return null;
  }
  return null;
}

export async function fetchCbrUsdRub(): Promise<number | null> {
  const hit = await fetchCbrUsdRubHit();
  return hit?.rate ?? null;
}

async function fetchRapiraRates(): Promise<Partial<MarketRates> & { ok: boolean }> {
  try {
    const res = await axios.get(RAPIRA_RATES_URL, {
      timeout: 8000,
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    const list: RapiraRate[] = Array.isArray(res.data?.data) ? res.data.data : [];
    const bySymbol = new Map(list.map((r) => [r.symbol, r]));

    const usdtRub = midFromRapira(bySymbol.get("USDT/RUB"));
    const btc = midFromRapira(bySymbol.get("BTC/USDT"));
    const eth = midFromRapira(bySymbol.get("ETH/USDT"));
    const sol = midFromRapira(bySymbol.get("SOL/USDT"));

    return {
      ok: Boolean(usdtRub || btc || eth || sol),
      ...(usdtRub ? { USDTUSDT: Number(usdtRub.toFixed(4)) } : {}),
      ...(btc ? { BTCUSDT: Number(btc.toFixed(2)) } : {}),
      ...(eth ? { ETHUSDT: Number(eth.toFixed(2)) } : {}),
      ...(sol ? { SOLUSDT: Number(sol.toFixed(2)) } : {}),
    };
  } catch {
    return { ok: false };
  }
}

async function fetchBybitLast(symbol: string): Promise<number | null> {
  try {
    const res = await axios.get(
      BYBIT_TICKERS_URL,
      {
        timeout: 8000,
        signal: AbortSignal.timeout(8000),
        params: { category: "spot", symbol },
      },
    );
    const last = parseFloat(res.data?.result?.list?.[0]?.lastPrice ?? "");
    return Number.isFinite(last) && last > 0 ? last : null;
  } catch {
    return null;
  }
}

async function fetchBinanceLast(symbol: string): Promise<number | null> {
  try {
    const res = await axios.get(BINANCE_PRICE_URL, {
      timeout: 8000,
      signal: AbortSignal.timeout(8000),
      params: { symbol },
    });
    const price = parseFloat(res.data?.price ?? "");
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/**
 * Рубль: только ЦБ РФ (USD/RUB как USDT) или зеркало.
 * Если ЦБ недоступен — последний ЦБ / ручной курс админа (в API).
 * Крипта: Rapira, затем Bybit, TON — Bybit затем Binance.
 * В БД храним mid. Клиенту: покупка +5 ₽, продажа −2 ₽ за 1 USDT.
 */
export async function fetchMarketRates(): Promise<MarketRates> {
  const defaults: MarketRates = {
    USDTUSDT: 0,
    BTCUSDT: 67500,
    ETHUSDT: 3500,
    TONUSDT: 7.3,
    SOLUSDT: 150,
    source: "fallback",
    sources: {},
    cbrOffline: true,
  };

  const [cbrHit, rapira] = await Promise.all([
    fetchCbrUsdRubHit(),
    fetchRapiraRates(),
  ]);
  const byPair: Record<string, string> = {};

  const cbrOffline = !cbrHit;
  let USDTUSDT = cbrHit?.rate ?? 0;
  let BTCUSDT = rapira.BTCUSDT ?? defaults.BTCUSDT;
  let ETHUSDT = rapira.ETHUSDT ?? defaults.ETHUSDT;
  let SOLUSDT = rapira.SOLUSDT ?? defaults.SOLUSDT;
  let TONUSDT = defaults.TONUSDT;

  if (cbrHit) byPair.USDT = cbrHit.source;
  else byPair.USDT = CBR_LAST_SOURCE;

  if (rapira.BTCUSDT) byPair.BTC = `Rapira (${RAPIRA_RATES_URL})`;
  if (rapira.ETHUSDT) byPair.ETH = `Rapira (${RAPIRA_RATES_URL})`;
  if (rapira.SOLUSDT) byPair.SOL = `Rapira (${RAPIRA_RATES_URL})`;

  const needBybit = !rapira.BTCUSDT || !rapira.ETHUSDT || !rapira.SOLUSDT;
  if (needBybit) {
    const [btc, eth, sol] = await Promise.all([
      rapira.BTCUSDT ? Promise.resolve(null) : fetchBybitLast("BTCUSDT"),
      rapira.ETHUSDT ? Promise.resolve(null) : fetchBybitLast("ETHUSDT"),
      rapira.SOLUSDT ? Promise.resolve(null) : fetchBybitLast("SOLUSDT"),
    ]);
    if (btc) {
      BTCUSDT = Number(btc.toFixed(2));
      byPair.BTC = `Bybit (${BYBIT_TICKERS_URL}?category=spot&symbol=BTCUSDT)`;
    }
    if (eth) {
      ETHUSDT = Number(eth.toFixed(2));
      byPair.ETH = `Bybit (${BYBIT_TICKERS_URL}?category=spot&symbol=ETHUSDT)`;
    }
    if (sol) {
      SOLUSDT = Number(sol.toFixed(2));
      byPair.SOL = `Bybit (${BYBIT_TICKERS_URL}?category=spot&symbol=SOLUSDT)`;
    }
  }

  const tonBybit = await fetchBybitLast("TONUSDT");
  const tonBinance = tonBybit ? null : await fetchBinanceLast("TONUSDT");
  const ton = tonBybit ?? tonBinance;
  if (ton) {
    TONUSDT = Number(ton.toFixed(4));
    byPair.TON = tonBybit
      ? `Bybit (${BYBIT_TICKERS_URL}?category=spot&symbol=TONUSDT)`
      : `Binance (${BINANCE_PRICE_URL}?symbol=TONUSDT)`;
  }

  if (!byPair.BTC) byPair.BTC = "fallback (захардкоженное значение)";
  if (!byPair.ETH) byPair.ETH = "fallback (захардкоженное значение)";
  if (!byPair.SOL) byPair.SOL = "fallback (захардкоженное значение)";
  if (!byPair.TON) byPair.TON = "fallback (захардкоженное значение)";

  const source = Object.entries(byPair)
    .map(([pair, origin]) => `${pair}: ${origin}`)
    .join(" | ");

  console.info("[rates] Курсы подгружены из:", byPair);
  console.info("[rates] сводка:", source);

  const sources: Record<string, string> = {
    USDTUSDT: byPair.USDT,
    BTCUSDT: byPair.BTC,
    ETHUSDT: byPair.ETH,
    SOLUSDT: byPair.SOL,
    TONUSDT: byPair.TON,
  };

  return {
    USDTUSDT,
    BTCUSDT,
    ETHUSDT,
    TONUSDT,
    SOLUSDT,
    source,
    sources,
    cbrOffline,
  };
}

export function ratesToUpsertRows(rates: MarketRates): RateRow[] {
  const updated_at = new Date().toISOString();
  const symbols: Array<
    keyof Omit<MarketRates, "source" | "sources" | "cbrOffline">
  > = ["BTCUSDT", "ETHUSDT", "TONUSDT", "SOLUSDT"];

  const rows = symbols.map((symbol) =>
    rateUpsert(symbol, rates[symbol], updated_at),
  );

  if (rates.USDTUSDT > 0) {
    rows.push(rateUpsert("USDTUSDT", rates.USDTUSDT, updated_at));
    if (!rates.cbrOffline) {
      rows.push(rateUpsert(USDT_CBR_LAST_SYMBOL, rates.USDTUSDT, updated_at));
    }
  }

  return rows;
}
