import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchMarketRates,
  ratesToUpsertRows,
} from "@/src/utils/market-rates";

const STALE_MS = 60_000;
const DB_TIMEOUT_MS = 4_000;

type RateRecord = {
  symbol: string;
  exchange_price: number;
  updated_at?: string | null;
};

function ratesResponse(
  rows: Array<{ symbol: string; exchange_price: number }>,
  headers: Record<string, string>,
) {
  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      ...headers,
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

export async function GET() {
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

  if (!isStale(rows)) {
    return ratesResponse(
      rows.map(({ symbol, exchange_price }) => ({ symbol, exchange_price })),
      { "X-Rates-Refreshed": "0" },
    );
  }

  const rates = await fetchMarketRates();
  const upsertRows = ratesToUpsertRows(rates);

  if (supabase) {
    try {
      const { error } = await supabase
        .from("crypto_rates")
        .upsert(upsertRows, { onConflict: "symbol" });
      if (error) console.warn("[crypto-rates] db write:", error.message);
    } catch (err) {
      console.warn("[crypto-rates] db write failed:", err);
    }
  }

  return ratesResponse(
    upsertRows.map(({ symbol, exchange_price }) => ({
      symbol,
      exchange_price,
    })),
    {
      "X-Rates-Source": rates.source,
      "X-Rates-Refreshed": "1",
    },
  );
}
