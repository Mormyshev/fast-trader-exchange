import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  applyUsdtFallback,
  fetchMarketRates,
  PUBLIC_RATE_SYMBOLS,
  ratesToUpsertRows,
  resolveOfflineUsdt,
  type MarketRates,
} from "@/src/utils/market-rates";
import {
  consumeRateLimit,
  getRequestIp,
  rateLimitJsonResponse,
} from "@/src/utils/rate-limit";

const DB_TIMEOUT_MS = 4_000;
/** Без cron курс в БД застывает. Живой ЦБ/биржи — не чаще раза в минуту. */
const LIVE_REFRESH_WINDOW_MS = 60_000;
const STALE_MS = 10 * 60 * 1000;

type RateRecord = {
  symbol: string;
  exchange_price: number;
  updated_at?: string | null;
};

type PublicRate = {
  symbol: string;
  exchange_price: number;
  source?: string;
  cbr_offline?: boolean;
};

type SymbolPayload = { exchange_price: number; source?: string };

/** Последние живые источники (ЦБ / Rapira / Bybit / Binance). */
let lastLiveSources: Record<string, string> = {};
let liveRefreshInFlight: Promise<{
  rates: MarketRates;
  upsertRows: ReturnType<typeof ratesToUpsertRows>;
} | null> | null = null;

function ratesResponse(
  rows: PublicRate[],
  cbrOffline: boolean,
  refreshed: boolean,
) {
  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      "X-Rates-Refreshed": refreshed ? "1" : "0",
      "X-Cbr-Offline": cbrOffline ? "1" : "0",
    },
  });
}

function createRatesDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(DB_TIMEOUT_MS),
        }),
    },
  });
}

function toPublicPayload(
  bySymbol: Record<string, SymbolPayload>,
  cbrOffline: boolean,
): PublicRate[] {
  return PUBLIC_RATE_SYMBOLS.map((symbol) => {
    const row = bySymbol[symbol];
    return {
      symbol,
      exchange_price: row?.exchange_price ?? 0,
      source: row?.source,
      ...(symbol === "USDTUSDT" ? { cbr_offline: cbrOffline } : {}),
    };
  });
}

function payloadFromRates(rates: MarketRates) {
  const bySymbol: Record<string, SymbolPayload> = {};
  for (const symbol of PUBLIC_RATE_SYMBOLS) {
    bySymbol[symbol] = {
      exchange_price: rates[symbol],
      source: rates.sources[symbol] ?? lastLiveSources[symbol],
    };
  }
  return ratesResponse(
    toPublicPayload(bySymbol, rates.cbrOffline),
    rates.cbrOffline,
    true,
  );
}

function payloadFromCache(rows: RateRecord[]) {
  const offlineUsdt = resolveOfflineUsdt(rows);
  const bySymbol: Record<string, SymbolPayload> = {};
  for (const row of rows) {
    bySymbol[row.symbol] = {
      exchange_price: row.exchange_price,
      source: lastLiveSources[row.symbol],
    };
  }
  const usdt = rows.find((row) => row.symbol === "USDTUSDT");
  const usdtSource = lastLiveSources.USDTUSDT || offlineUsdt.source;
  bySymbol.USDTUSDT = {
    exchange_price: usdt?.exchange_price ?? offlineUsdt.rate,
    source: usdtSource,
  };
  const cbrOffline =
    !usdtSource ||
    usdtSource.includes("последний курс") ||
    usdtSource.includes("задан админом");
  return ratesResponse(toPublicPayload(bySymbol, cbrOffline), cbrOffline, false);
}

function cacheIsStale(rows: RateRecord[]): boolean {
  const usdt = rows.find((row) => row.symbol === "USDTUSDT");
  if (!usdt || !(usdt.exchange_price > 0)) return true;
  const stamp = usdt.updated_at ? Date.parse(usdt.updated_at) : NaN;
  if (!Number.isFinite(stamp) || stamp <= 0) return true;
  return Date.now() - stamp > STALE_MS;
}

async function persistRates(
  supabase: ReturnType<typeof createRatesDb>,
  rows: ReturnType<typeof ratesToUpsertRows>,
) {
  if (!supabase || rows.length === 0) return;
  try {
    const { error } = await supabase
      .from("crypto_rates")
      .upsert(rows, { onConflict: "symbol" });
    if (error) console.warn("[crypto-rates] db write:", error.message);
  } catch (err) {
    console.warn("[crypto-rates] db write failed:", err);
  }
}

async function refreshLive(
  supabase: ReturnType<typeof createRatesDb>,
  rows: RateRecord[],
) {
  if (liveRefreshInFlight) return liveRefreshInFlight;

  liveRefreshInFlight = (async () => {
    try {
      const fetched = await fetchMarketRates();
      const rates = applyUsdtFallback(fetched, rows);
      const upsertRows = ratesToUpsertRows(rates);
      lastLiveSources = { ...rates.sources };
      await persistRates(supabase, upsertRows);
      return { rates, upsertRows };
    } catch (err) {
      console.warn("[crypto-rates] live refresh failed:", err);
      return null;
    }
  })();

  try {
    return await liveRefreshInFlight;
  } finally {
    liveRefreshInFlight = null;
  }
}

export async function GET(request: Request) {
  if (
    !consumeRateLimit(`crypto-rates:${getRequestIp(request)}`, 60, 60_000)
  ) {
    return rateLimitJsonResponse();
  }

  let rows: RateRecord[] = [];
  const supabase = createRatesDb();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("crypto_rates")
        .select("symbol, exchange_price, updated_at");
      if (!error && data) rows = data;
      else if (error) console.warn("[crypto-rates] db read:", error.message);
    } catch (err) {
      console.warn("[crypto-rates] db read failed:", err);
    }
  }

  const stale = cacheIsStale(rows);
  const allowLive =
    stale &&
    (Boolean(liveRefreshInFlight) ||
      consumeRateLimit("crypto-rates:live-refresh", 1, LIVE_REFRESH_WINDOW_MS));

  if (allowLive) {
    const live = await refreshLive(supabase, rows);
    if (live?.rates.USDTUSDT) {
      return payloadFromRates(live.rates);
    }
  }

  return payloadFromCache(rows);
}
