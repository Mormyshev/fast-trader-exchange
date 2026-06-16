import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  console.log("\n=== [API] СИНХРОНИЗАЦИЯ ЧЕРЕЗ AXIOS ===");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Переменные окружения Supabase не найдены." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  let dynamicUsdtRubPrice = 93.5;
  let btcPrice = 67500,
    ethPrice = 3500,
    tonPrice = 7.3,
    solPrice = 150;
  let liveMarket = false;

  let diagnostics: any = {};

  // 1. ЗАПРОС К ЦБ РФ (Фиат)
  try {
    const fiatRes = await axios.get("https://cbr-xml-daily.ru", {
      timeout: 4000,
    });

    if (fiatRes.data && fiatRes.data.Valute?.USD?.Value) {
      dynamicUsdtRubPrice = parseFloat(
        (fiatRes.data.Valute.USD.Value * 1.015).toFixed(2),
      );
    } else {
      diagnostics.fiatStructureError = "Неверная структура ответа ЦБ";
    }
  } catch (e: any) {
    diagnostics.fiatError = `Axios сбой ЦБ: ${e.message}. Тип данных: ${typeof e.response?.data}`;
  }

  // 2. ЗАПРОС К MEXC API (Крипта)
  try {
    const cryptoRes = await axios.get("https://mexc.com", { timeout: 4000 });
    const tickerList = cryptoRes.data;

    if (Array.isArray(tickerList)) {
      const btcTicker = tickerList.find((t: any) => t.symbol === "BTCUSDT");
      const ethTicker = tickerList.find((t: any) => t.symbol === "ETHUSDT");
      const tonTicker = tickerList.find((t: any) => t.symbol === "TONUSDT");
      const solTicker = tickerList.find((t: any) => t.symbol === "SOLUSDT");

      if (btcTicker?.price) btcPrice = parseFloat(btcTicker.price);
      if (ethTicker?.price) ethPrice = parseFloat(ethTicker.price);
      if (tonTicker?.price) tonPrice = parseFloat(tonTicker.price);
      // ИСПРАВЛЕНО: Теперь свойство .price берётся у правильного объекта solTicker
      if (solTicker?.price) solPrice = parseFloat(solTicker.price);

      liveMarket = true;
    } else {
      diagnostics.cryptoStructureError = "Mexc вернул не массив";
    }
  } catch (e: any) {
    diagnostics.cryptoError = `Axios сбой Mexc: ${e.message}. Код: ${e.code}`;
  }

  // 3. ЗАПИСЬ В БАЗУ SUPABASE
  const upsertRows = [
    {
      symbol: "BTCUSDT",
      base_price: btcPrice,
      exchange_price: btcPrice,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: "ETHUSDT",
      base_price: ethPrice,
      exchange_price: ethPrice,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: "TONUSDT",
      base_price: tonPrice,
      exchange_price: tonPrice,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: "SOLUSDT",
      base_price: solPrice,
      exchange_price: solPrice,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: "USDTUSDT",
      base_price: dynamicUsdtRubPrice,
      exchange_price: dynamicUsdtRubPrice,
      updated_at: new Date().toISOString(),
    },
  ];

  try {
    const { error } = await supabase
      .from("crypto_rates")
      .upsert(upsertRows, { onConflict: "symbol" });
    if (error) diagnostics.dbError = error.message;
  } catch (err: any) {
    diagnostics.dbError = err.message;
  }

  return NextResponse.json({
    success: true,
    live_market_data: liveMarket,
    diagnostics:
      Object.keys(diagnostics).length > 0
        ? diagnostics
        : "Идеально! Axios пробил роутер!",
    updated: upsertRows.length,
    data: upsertRows,
  });
}
