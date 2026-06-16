import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  console.log("\n=== [API] СИНХРОНИЗАЦИЯ ЧЕРЕЗ AXIOS (COINBASE) ===");

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
      timeout: 5000,
      responseType: "json", // Явно заставляем Axios распарсить JSON
    });

    // Подстраховка на случай, если пришла строка вместо объекта
    const fiatData =
      typeof fiatRes.data === "string"
        ? JSON.parse(fiatRes.data)
        : fiatRes.data;

    if (fiatData && fiatData.Valute?.USD?.Value) {
      dynamicUsdtRubPrice = parseFloat(
        (fiatData.Valute.USD.Value * 1.015).toFixed(2),
      );
    } else {
      diagnostics.fiatStructureError =
        "Поле Valute.USD.Value не найдено в ответе ЦБ";
    }
  } catch (e: any) {
    diagnostics.fiatError = `Axios сбой ЦБ: ${e.message}`;
  }

  // 2. ЗАПРОС К COINBASE API (Крипта - 100% открыта на Vercel)
  try {
    const cryptoRes = await axios.get("https://coinbase.com", {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const rates = cryptoRes.data?.data?.rates;

    if (rates && rates.BTC && rates.ETH) {
      // Конвертируем "монеты за 1 USD" в привычную стоимость "USD за 1 монету"
      btcPrice = parseFloat((1 / parseFloat(rates.BTC)).toFixed(2));
      ethPrice = parseFloat((1 / parseFloat(rates.ETH)).toFixed(2));
      tonPrice = rates.TON
        ? parseFloat((1 / parseFloat(rates.TON)).toFixed(4))
        : 7.35;
      solPrice = rates.SOL
        ? parseFloat((1 / parseFloat(rates.SOL)).toFixed(2))
        : 151.2;

      liveMarket = true;
    } else {
      diagnostics.cryptoStructureError =
        "В ответе Coinbase отсутствуют BTC или ETH";
    }
  } catch (e: any) {
    diagnostics.cryptoError = `Axios сбой Coinbase: ${e.message}`;
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
        : "Идеально! Все данные получены вживую!",
    updated: upsertRows.length,
    data: upsertRows,
  });
}
