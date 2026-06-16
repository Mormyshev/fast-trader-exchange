import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import https from "https";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Описываем структуру данных, которую возвращает Mexc API
interface MexcTicker {
  symbol: string;
  price: string;
}

// Изолированная функция сетевого запроса с автоматической поддержкой редиректов (до 3 переходов)
const nativeRequest = (url: string, redirectsFollowed = 0): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (redirectsFollowed > 3) return reject(new Error("Too many redirects"));

    const req = https.get(
      url,
      {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/json",
        },
      },
      (res) => {
        // Автоматический переход по 301/302 редиректам
        if (
          [301, 302, 307, 308].includes(res.statusCode || 0) &&
          res.headers.location
        ) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith("/")) {
            redirectUrl = new URL(url).origin + redirectUrl;
          }
          return resolve(nativeRequest(redirectUrl, redirectsFollowed + 1));
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      },
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
};

export async function GET() {
  console.log("\n=== [API] СИНХРОНИЗАЦИЯ ЧЕРЕЗ NATIVE NODE.JS (FINAL) ===");

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

  // 1. ЗАПРОС К ЦБ РФ (Фиат с обработкой 301 редиректа)
  try {
    const fiatRaw = await nativeRequest("https://cbr-xml-daily.ru");
    if (fiatRaw.trim().startsWith("{")) {
      const parsed = JSON.parse(fiatRaw);
      if (parsed.Valute?.USD?.Value) {
        dynamicUsdtRubPrice = parseFloat(
          (parsed.Valute.USD.Value * 1.015).toFixed(2),
        );
      }
    } else {
      diagnostics.fiatRawSample = fiatRaw.substring(0, 100);
    }
  } catch (e: any) {
    diagnostics.fiatError = e.message;
  }

  // 2. ЗАПРОС К MEXC API (Крипта без блокировок Cloudflare)
  // 2. ЗАПРОС К MEXC API (Крипта без блокировок Cloudflare)
  try {
    const cryptoRaw = await nativeRequest("https://mexc.com");
    if (cryptoRaw.trim().startsWith("[")) {
      // ИСПОЛЬЗУЕМ any[], ЧТОБЫ ГАРАНТИРОВАННО УБРАТЬ ОШИБКУ PROPERTY 'PRICE' DOES NOT EXIST
      const tickerList = JSON.parse(cryptoRaw) as any[];

      if (Array.isArray(tickerList)) {
        const btcTicker: any = tickerList.find(
          (t: any) => t.symbol === "BTCUSDT",
        );
        const ethTicker: any = tickerList.find(
          (t: any) => t.symbol === "ETHUSDT",
        );
        const tonTicker: any = tickerList.find(
          (t: any) => t.symbol === "TONUSDT",
        );
        const solTicker: any = tickerList.find(
          (t: any) => t.symbol === "SOLUSDT",
        );

        if (btcTicker && btcTicker.price)
          btcPrice = parseFloat(btcTicker.price);
        if (ethTicker && ethTicker.price)
          ethPrice = parseFloat(ethTicker.price);
        if (tonTicker && tonTicker.price)
          tonPrice = parseFloat(tonTicker.price);
        if (solTicker && solTicker.price)
          solPrice = parseFloat(solTicker.price);

        liveMarket = true;
      }
    } else {
      diagnostics.cryptoRawSample = cryptoRaw.substring(0, 100);
    }
  } catch (e: any) {
    diagnostics.cryptoError = e.message;
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
        : "Ошибок нет, сеть работает напрямую!",
    updated: upsertRows.length,
    data: upsertRows,
  });
}
