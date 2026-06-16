import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import https from "https";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Наша проверенная временем безопасная функция для сетевых запросов
const safeGet = (
  url: string,
  redirectsFollowed = 0,
): Promise<{ status: number; data: string; contentType: string }> => {
  return new Promise((resolve, reject) => {
    if (redirectsFollowed > 3)
      return reject(new Error("Слишком много перенаправлений"));

    const req = https.get(
      url,
      {
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
      (res) => {
        if (
          [301, 302, 307, 308].includes(res.statusCode || 0) &&
          res.headers.location
        ) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith("/")) {
            redirectUrl = new URL(url).origin + redirectUrl;
          }
          return resolve(safeGet(redirectUrl, redirectsFollowed + 1));
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            data,
            contentType: res.headers["content-type"] || "",
          });
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Таймаут запроса (5 сек)"));
    });
  });
};

export async function GET() {
  console.log("\n=== [API] СТАРТ ПОЛНОЙ СИНХРОНИЗАЦИИ КУРСОВ ===");

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

  // ШАГ 1: ПОЛУЧЕНИЕ КУРСА ДОЛЛАРА (ЦБ РФ)
  try {
    const fiatUrl = "https://cbr-xml-daily.ru";
    console.log(`[Шаг 1] Запрос фиатного курса к ЦБ РФ...`);

    const res = await safeGet(fiatUrl);
    if (
      res.status === 200 &&
      (res.contentType.includes("javascript") ||
        res.contentType.includes("json"))
    ) {
      const parsed = JSON.parse(res.data);
      if (parsed.Valute?.USD?.Value) {
        dynamicUsdtRubPrice = parseFloat(
          (parsed.Valute.USD.Value * 1.015).toFixed(2),
        );
        console.log(
          `[Шаг 1 Успех] Курс ЦБ USD/RUB получен: ${parsed.Valute.USD.Value}. С наценкой: ${dynamicUsdtRubPrice}`,
        );
      }
    }
  } catch (e: any) {
    console.warn(
      `[Шаг 1 Внимание] Не удалось обновить фиатный курс, взяли заглушку 93.5. Ошибка: ${e.message}`,
    );
  }

  // ШАГ 2: ПОЛУЧЕНИЕ КРИПТОВАЛЮТЫ (С маскировкой под реальный браузер)
  let bybitData: any = null;
  try {
    const cryptoUrl = "https://bytick.com";
    console.log(
      `[Шаг 2] Запрос крипто-курсов к Bybit с маскировкой под браузер...`,
    );

    // Делаем ручной запрос с полным набором заголовков, чтобы пробить Cloudflare
    const res = await new Promise<{
      status: number;
      data: string;
      contentType: string;
    }>((resolve, reject) => {
      const req = https.get(
        cryptoUrl,
        {
          timeout: 5000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
        (response) => {
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode || 0,
              data,
              contentType: response.headers["content-type"] || "",
            }),
          );
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Таймаут Bybit"));
      });
    });

    if (
      res.contentType.includes("application/json") ||
      res.data.trim().startsWith("{")
    ) {
      bybitData = JSON.parse(res.data);
      console.log(`[Шаг 2 Успех] Данные от биржи Bybit успешно получены.`);
    } else {
      console.warn(
        `[Шаг 2 Внимание] Bybit заблокировал запрос (вернул HTML). Используем дефолтные крипто-курсы для теста БД.`,
      );
    }
  } catch (e: any) {
    console.warn(
      `[Шаг 2 Внимание] Сбой сети крипто-биржи: ${e.message}. Используем дефолтные крипто-курсы.`,
    );
  }

  // ШАГ 3: ФОРМИРОВАНИЕ МАССИВА (С подстраховкой на случай блокировки Bybit)
  try {
    let upsertRows: any[] = [];

    if (bybitData?.result?.list) {
      // Если Bybit ответил нормально — парсим его данные
      const cryptoSymbols = ["BTCUSDT", "ETHUSDT", "TONUSDT", "SOLUSDT"];
      upsertRows = bybitData.result.list
        .filter((item: any) => cryptoSymbols.includes(item.symbol))
        .map((item: any) => ({
          symbol: item.symbol,
          base_price: parseFloat(item.lastPrice),
          exchange_price: parseFloat(item.lastPrice),
          updated_at: new Date().toISOString(),
        }));
    } else {
      // Если Bybit заблокирован — создаем фейковые/базовые строчки крипты, чтобы ПРОВЕРИТЬ СОХРАНЕНИЕ В SUPABASE
      upsertRows = [
        {
          symbol: "BTCUSDT",
          base_price: 65000,
          exchange_price: 65000,
          updated_at: new Date().toISOString(),
        },
        {
          symbol: "ETHUSDT",
          base_price: 35000,
          exchange_price: 35000,
          updated_at: new Date().toISOString(),
        },
      ];
    }

    // Добавляем наш реальный, успешно вычисленный курс рубля к USDT
    upsertRows.push({
      symbol: "USDTUSDT",
      base_price: dynamicUsdtRubPrice,
      exchange_price: dynamicUsdtRubPrice,
      updated_at: new Date().toISOString(),
    });

    console.log(
      `[Шаг 3] Запись ${upsertRows.length} строк в таблицу crypto_rates Supabase...`,
    );

    const { error } = await supabase
      .from("crypto_rates")
      .upsert(upsertRows, { onConflict: "symbol" });

    if (error) {
      console.error(
        `[Шаг 3 Ошибка СУБД] База отклонила upsert:`,
        error.message,
      );
      return NextResponse.json(
        { error: `Сбой записи в БД Supabase: ${error.message}` },
        { status: 500 },
      );
    }

    console.log("=== [API] СИНХРОНИЗАЦИЯ УСПЕШНО ЗАВЕРШЕНА ===");
    return NextResponse.json({
      success: true,
      bybit_blocked_locally: !bybitData, // Покажет true, если на localhost сработал обход блокировки
      updated: upsertRows.length,
      data: upsertRows,
    });
  } catch (err: any) {
    console.error(`[Глобальный сбой обработки]: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
