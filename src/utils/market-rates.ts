import axios from "axios";

/** Отступ от рыночного mid в обе стороны */
export const RATE_SPREAD = 0.03;

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

/** Курс для покупки крипты за RUB (пользователь платит больше) */
export function applyBuySpread(midRubPerUsdt: number): number {
  return midRubPerUsdt * (1 + RATE_SPREAD);
}

/** Курс для продажи крипты за RUB (пользователь получает меньше) */
export function applySellSpread(midRubPerUsdt: number): number {
  return midRubPerUsdt * (1 - RATE_SPREAD);
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
 * Берём mid с Rapira (USDT/RUB + крипта), недостающее — с Bybit / Binance.
 * Спред ±3% на клиенте / при расчёте заявки, в БД храним mid.
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

  const rapira = await fetchRapiraRates();
  const sources: string[] = [];

  let USDTUSDT = rapira.USDTUSDT ?? defaults.USDTUSDT;
  let BTCUSDT = rapira.BTCUSDT ?? defaults.BTCUSDT;
  let ETHUSDT = rapira.ETHUSDT ?? defaults.ETHUSDT;
  let SOLUSDT = rapira.SOLUSDT ?? defaults.SOLUSDT;
  let TONUSDT = defaults.TONUSDT;

  if (rapira.USDTUSDT) sources.push("rapira:USDT/RUB");
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
    // mid в exchange_price; ±3% применяется в UI по направлению сделки
    exchange_price: rates[symbol],
    updated_at,
  }));
}
