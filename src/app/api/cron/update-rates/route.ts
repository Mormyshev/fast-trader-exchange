import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Переменные окружения не найдены." },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Делаем параллельные запросы к API Bybit и фиатному шлюзу валют
    const [bybitRes, fiatRes] = await Promise.all([
      fetch("https://bytick.com", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        next: { revalidate: 0 },
      }),
      fetch("https://er-api.com", { method: "GET", next: { revalidate: 0 } }),
    ]);

    let dynamicUsdtRubPrice = 93.5;
    if (fiatRes.ok) {
      const fiatData = await fiatRes.json();
      if (fiatData.rates?.RUB) {
        dynamicUsdtRubPrice = parseFloat(
          (fiatData.rates.RUB * 1.015).toFixed(2),
        );
      }
    }

    const contentType = bybitRes.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Биржа вернула HTML. В продакшене ошибка уйдет." },
        { status: 502 },
      );
    }

    const bybitData = await bybitRes.json();
    if (!bybitData.result?.list) {
      return NextResponse.json(
        { error: "Неверная структура ответа" },
        { status: 500 },
      );
    }

    const cryptoSymbols = ["BTCUSDT", "ETHUSDT", "TONUSDT", "SOLUSDT"];
    const upsertRows = bybitData.result.list
      .filter((item: any) => cryptoSymbols.includes(item.symbol))
      .map((item: any) => ({
        symbol: item.symbol,
        base_price: parseFloat(item.lastPrice),
        exchange_price: parseFloat(item.lastPrice),
        updated_at: new Date().toISOString(),
      }));

    upsertRows.push({
      symbol: "USDTUSDT",
      base_price: dynamicUsdtRubPrice,
      exchange_price: dynamicUsdtRubPrice,
      updated_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from("crypto_rates")
      .upsert(upsertRows, { onConflict: "symbol" });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      updated: upsertRows.length,
      data: upsertRows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
