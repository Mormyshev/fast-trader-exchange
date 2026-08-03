import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import {
  fetchMarketRates,
  ratesToUpsertRows,
} from "@/src/utils/market-rates";

const STALE_MS = 60_000;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("crypto_rates")
      .select("symbol, exchange_price, updated_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const usdtRow = rows.find((r) => r.symbol === "USDTUSDT");
    const updatedAt = usdtRow?.updated_at
      ? Date.parse(usdtRow.updated_at)
      : 0;
    const isStale =
      !usdtRow ||
      !Number.isFinite(updatedAt) ||
      Date.now() - updatedAt > STALE_MS;

    if (isStale) {
      try {
        const rates = await fetchMarketRates();
        const upsertRows = ratesToUpsertRows(rates);
        await supabase
          .from("crypto_rates")
          .upsert(upsertRows, { onConflict: "symbol" });

        return NextResponse.json(
          upsertRows.map(({ symbol, exchange_price }) => ({
            symbol,
            exchange_price,
          })),
          {
            headers: {
              "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
              "X-Rates-Source": rates.source,
              "X-Rates-Refreshed": "1",
            },
          },
        );
      } catch {
        // отдаём то, что есть в БД
      }
    }

    return NextResponse.json(
      rows.map(({ symbol, exchange_price }) => ({ symbol, exchange_price })),
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
          "X-Rates-Refreshed": "0",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
