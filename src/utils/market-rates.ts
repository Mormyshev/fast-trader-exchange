import axios from "axios";

/** Клиент покупает крипту: к курсу ЦБ +5 ₽ за 1 USDT */
export const CLIENT_BUY_MARKUP_RUB = 5;
/** Клиент продаёт крипту: от курса ЦБ −2 ₽ за 1 USDT */
export const CLIENT_SELL_MARKDOWN_RUB = 2;

export type MarketRates = {
  /** Mid: сколько RUB за 1 USDT */
  USDTUSDT: number;
  BTCUSDT: number;
  ETHUSDT: number;
  TONUSDT: number;
  SOLUSDT: number;
  source: string;
};

export type RateRow = {
  symbol: keyof Omit<MarketRates, "source"> | string;
  base_price: number;
  exchange_price: number;
  updated_at: string;
};

/** Курс покупки крипты за RUB (клиент платит ЦБ + 5 ₽ за USDT) */
export function applyBuySpread(midRubPerUsdt: number): number {
  return midRubPerUsdt + CLIENT_BUY_MARKUP_RUB;
}

/** Курс продажи крипты за RUB (клиент получает ЦБ − 2 ₽ за USDT) */
export function applySellSpread(midRubPerUsdt: number): number {
  const next = midRubPerUsdt - CLIENT_SELL_MARKDOWN_RUB;
  return next > 0 ? next : midRubPerUsdt;
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
      "User-Agent": "AurumSwap/1.0",
    },
  });
  const xml = typeof res.data === "string" ? res.data : String(res.data ?? "");
  const rate = parseCbrRubPerUsd(xml);
  return rate && rate > 0 ? Number(rate.toFixed(4)) : null;
}

async function fetchCbrJsonMirror(): Promise<number | null> {
  const res = await axios.get("https://www.cbr-xml-daily.ru/daily_json.js", {
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

/** Официальный USD/RUB ЦБ РФ. USDT на сайте считается по этому курсу, без спреда. */
export async function fetchCbrUsdRub(): Promise<number | null> {
  const dated = `https://www.cbr.ru/scripts/XML_daily.asp?date_req=${encodeURIComponent(moscowDateReq())}`;
  const latest = "https://www.cbr.ru/scripts/XML_daily.asp";

  for (const url of [dated, latest]) {
    try {
      const rate = await fetchCbrXml(url);
      if (rate) return rate;
    } catch {
      // следующий источник ЦБ
    }
  }

  try {
    return await fetchCbrJsonMirror();
  } catch {
    return null;
  }
}

async function fetchRapiraRates(): Promise<Partial<MarketRates> & { ok: boolean }> {
  try {
    const res = await axios.get("https://api.rapira.net/open/market/rates", {
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
      "https://api.bybit.com/v5/market/tickers",
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
    const res = await axios.get("https://api.binance.com/api/v3/ticker/price", {
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
 * Рубль: ЦБ РФ (USD/RUB как USDT), затем Rapira USDT/RUB.
 * Крипта: Rapira, затем Bybit, TON — Bybit затем Binance.
 * В БД храним mid ЦБ. Клиенту: покупка +5 ₽, продажа −2 ₽ за 1 USDT.
 */
export async function fetchMarketRates(): Promise<MarketRates> {
  const defaults: MarketRates = {
    USDTUSDT: 93.5,
    BTCUSDT: 67500,
    ETHUSDT: 3500,
    TONUSDT: 7.3,
    SOLUSDT: 150,
    source: "fallback",
  };

  const [cbrUsdRub, rapira] = await Promise.all([
    fetchCbrUsdRub(),
    fetchRapiraRates(),
  ]);
  const sources: string[] = [];

  let USDTUSDT = cbrUsdRub ?? rapira.USDTUSDT ?? defaults.USDTUSDT;
  let BTCUSDT = rapira.BTCUSDT ?? defaults.BTCUSDT;
  let ETHUSDT = rapira.ETHUSDT ?? defaults.ETHUSDT;
  let SOLUSDT = rapira.SOLUSDT ?? defaults.SOLUSDT;
  let TONUSDT = defaults.TONUSDT;

  if (cbrUsdRub) sources.push("cbr:USD/RUB");
  else if (rapira.USDTUSDT) sources.push("rapira:USDT/RUB");
  if (rapira.BTCUSDT) sources.push("rapira:BTC");
  if (rapira.ETHUSDT) sources.push("rapira:ETH");
  if (rapira.SOLUSDT) sources.push("rapira:SOL");

  const needBybit = !rapira.BTCUSDT || !rapira.ETHUSDT || !rapira.SOLUSDT;
  if (needBybit) {
    const [btc, eth, sol] = await Promise.all([
      rapira.BTCUSDT ? Promise.resolve(null) : fetchBybitLast("BTCUSDT"),
      rapira.ETHUSDT ? Promise.resolve(null) : fetchBybitLast("ETHUSDT"),
      rapira.SOLUSDT ? Promise.resolve(null) : fetchBybitLast("SOLUSDT"),
    ]);
    if (btc) {
      BTCUSDT = Number(btc.toFixed(2));
      sources.push("bybit:BTC");
    }
    if (eth) {
      ETHUSDT = Number(eth.toFixed(2));
      sources.push("bybit:ETH");
    }
    if (sol) {
      SOLUSDT = Number(sol.toFixed(2));
      sources.push("bybit:SOL");
    }
  }

  const tonBybit = await fetchBybitLast("TONUSDT");
  const tonBinance = tonBybit ? null : await fetchBinanceLast("TONUSDT");
  const ton = tonBybit ?? tonBinance;
  if (ton) {
    TONUSDT = Number(ton.toFixed(4));
    sources.push(tonBybit ? "bybit:TON" : "binance:TON");
  }

  return {
    USDTUSDT,
    BTCUSDT,
    ETHUSDT,
    TONUSDT,
    SOLUSDT,
    source: sources.length > 0 ? sources.join(",") : defaults.source,
  };
}

export function ratesToUpsertRows(rates: MarketRates): RateRow[] {
  const updated_at = new Date().toISOString();
  const symbols: Array<keyof Omit<MarketRates, "source">> = [
    "BTCUSDT",
    "ETHUSDT",
    "TONUSDT",
    "SOLUSDT",
    "USDTUSDT",
  ];

  return symbols.map((symbol) => ({
    symbol,
    base_price: rates[symbol],
    // mid в exchange_price; +5 / −2 ₽ к USDT применяются в UI по направлению
    exchange_price: rates[symbol],
    updated_at,
  }));
}
