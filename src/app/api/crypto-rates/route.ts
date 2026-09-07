import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  applyUsdtFallback,
  fetchCbrUsdRubHit,
  fetchMarketRates,
  PUBLIC_RATE_SYMBOLS,
  ratesToUpsertRows,
  resolveOfflineUsdt,
  USDT_CBR_LAST_SYMBOL,
} from "@/src/utils/market-rates";

const STALE_MS = 60_000;
const DB_TIMEOUT_MS = 4_000;

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

/** Последние живые источники (ЦБ / Rapira / Bybit / Binance). */
let lastLiveSources: Record<string, string> = {};

function ratesResponse(rows: PublicRate[], cbrOffline: boolean, refreshed: boolean) {
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

function isStale(rows: RateRecord[]) {
  const usdtRow = rows.find((r) => r.symbol === "USDTUSDT");
  const updatedAt = usdtRow?.updated_at ? Date.parse(usdtRow.updated_at) : 0;
  return (
    !usdtRow ||
    !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt > STALE_MS
  );
}

function hasLiveSources() {
  return Boolean(
    lastLiveSources.USDTUSDT &&
      lastLiveSources.BTCUSDT &&
      lastLiveSources.ETHUSDT &&
      lastLiveSources.SOLUSDT &&
      lastLiveSources.TONUSDT,
  );
}

function toPublicPayload(
  bySymbol: Record<string, { exchange_price: number; source?: string }>,
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

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
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

  const needLive = fresh || isStale(rows) || !hasLiveSources();

  if (!needLive) {
    const cbrHit = await fetchCbrUsdRubHit();
    const cbrOffline = !cbrHit;
    const offlineUsdt = resolveOfflineUsdt(rows);

    if (cbrHit) {
      lastLiveSources = { ...lastLiveSources, USDTUSDT: cbrHit.source };
      const now = new Date().toISOString();
      await persistRates(supabase, [
        {
          symbol: "USDTUSDT",
          base_price: cbrHit.rate,
          exchange_price: cbrHit.rate,
          updated_at: now,
        },
        {
          symbol: USDT_CBR_LAST_SYMBOL,
          base_price: cbrHit.rate,
          exchange_price: cbrHit.rate,
          updated_at: now,
        },
      ]);
    } else {
      lastLiveSources = { ...lastLiveSources, USDTUSDT: offlineUsdt.source };
    }

    const bySymbol: Record<string, { exchange_price: number; source?: string }> =
      {};
    for (const row of rows) {
      bySymbol[row.symbol] = {
        exchange_price: row.exchange_price,
        source: lastLiveSources[row.symbol],
      };
    }
    bySymbol.USDTUSDT = {
      exchange_price: cbrHit ? cbrHit.rate : offlineUsdt.rate,
      source: lastLiveSources.USDTUSDT,
    };

    console.info(
      "[crypto-rates] кэш чисел из crypto_rates, ЦБ:",
      cbrOffline ? "офлайн" : cbrHit?.source,
    );
    return ratesResponse(toPublicPayload(bySymbol, cbrOffline), cbrOffline, false);
  }

  console.info(
    fresh
      ? "[crypto-rates] принудительное обновление внешних API"
      : "[crypto-rates] кэш устарел — запрос к внешним API",
  );
  const fetched = await fetchMarketRates();
  const rates = applyUsdtFallback(fetched, rows);
  const upsertRows = ratesToUpsertRows(rates);
  lastLiveSources = { ...rates.sources };

  await persistRates(supabase, upsertRows);

  const bySymbol: Record<string, { exchange_price: number; source?: string }> =
    {};
  for (const row of upsertRows) {
    bySymbol[row.symbol] = {
      exchange_price: row.exchange_price,
      source: rates.sources[row.symbol] ?? lastLiveSources[row.symbol],
    };
  }
  bySymbol.USDTUSDT = {
    exchange_price: rates.USDTUSDT,
    source: rates.sources.USDTUSDT,
  };

  return ratesResponse(
    toPublicPayload(bySymbol, rates.cbrOffline),
    rates.cbrOffline,
    true,
  );
}
