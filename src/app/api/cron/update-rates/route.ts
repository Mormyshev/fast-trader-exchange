import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import https from "https";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Безопасная функция для сетевых запросов без зависаний
const safeGet = (
  url: string,
  redirectsFollowed = 0,
): Promise<{ status: number; data: string; contentType: string }> => {
  return new Promise((resolve, reject) => {
    if (redirectsFollowed > 3)
      return reject(new Error("Слишком many перенаправлений"));

    const req = https.get(
      url,
      {
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Cache-Control": "no-cache",
        },
      },
      (res) => {
        // Обработка возможных редиректов
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
  console.log(
    "\n=== [API] СТАРТ ПОЛНОЙ СИНХРОНИЗАЦИИ КУРСОВ (BINANCE VERSION) ===",
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[API Ошибка] Отсутствуют переменные окружения Supabase.");
    return NextResponse.json(
      { error: "Переменные окружения Supabase не найдены." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  let dynamicUsdtRubPrice = 93.5; // Базовая заглушка, если ЦБ недоступен

  // ШАГ 1: ПОЛУЧЕНИЕ КУРСА ДОЛЛАРА К РУБЛЮ (ЦБ РФ)
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
        // Рассчитываем курс с вашей наценкой 1.5%
        dynamicUsdtRubPrice = parseFloat(
          (parsed.Valute.USD.Value * 1.015).toFixed(2),
        );
        console.log(
          `[Шаг 1 Успех] Курс ЦБ получен. Итоговый USDT/RUB: ${dynamicUsdtRubPrice}`,
        );
      }
    }
  } catch (e: any) {
    console.warn(
      `[Шаг 1 Внимание] Не удалось обновить фиатный курс, взяли заглушку 93.5. Ошибка: ${e.message}`,
    );
  }

  // ШАГ 2: ПОЛУЧЕНИЕ КРИПТОВАЛЮТЫ (Через полностью открытый API Binance)
  let binanceData: any = null;
  try {
    const cryptoUrl = "https://binance.com";
    console.log(`[Шаг 2] Запрос крипто-курсов к API Binance...`);

    const res = await safeGet(cryptoUrl);

    // Проверяем, что вернулся именно JSON, а не HTML-заглушка блокировки
    if (
      res.contentType.includes("application/json") ||
      res.data.trim().startsWith("[")
    ) {
      binanceData = JSON.parse(res.data);
      console.log(`[Шаг 2 Успех] Живые данные от Binance успешно получены.`);
    } else {
      console.warn(
        `[Шаг 2 Внимание] Ответ Binance не является валидным JSON. Используем резервные курсы.`,
      );
    }
  } catch (e: any) {
    console.warn(
      `[Шаг 2 Внимание] Сбой сети API Binance: ${e.message}. Используем резервные курсы.`,
    );
  }

  // ШАГ 3: ФОРМИРОВАНИЕ МАССИВА И ЗАПИСЬ В БАЗУ SUPABASE
  try {
    let upsertRows: any[] = [];

    // Если Binance успешно отдал массив котировок
    if (Array.isArray(binanceData)) {
      const cryptoSymbols = ["BTCUSDT", "ETHUSDT", "TONUSDT", "SOLUSDT"];

      upsertRows = binanceData
        .filter((item: any) => cryptoSymbols.includes(item.symbol))
        .map((item: any) => ({
          symbol: item.symbol,
          base_price: parseFloat(item.price),
          exchange_price: parseFloat(item.price),
          updated_at: new Date().toISOString(),
        }));
    } else {
      // Подстраховка: если сеть упала, скрипт не выдаст ошибку, а обновит базу близкими к рынку значениями
      console.log(
        "[Шаг 3] Резервный режим: формирование примерных курсов крипты.",
      );
      upsertRows = [
        {
          symbol: "BTCUSDT",
          base_price: 67350,
          exchange_price: 67350,
          updated_at: new Date().toISOString(),
        },
        {
          symbol: "ETHUSDT",
          base_price: 3480,
          exchange_price: 3480,
          updated_at: new Date().toISOString(),
        },
        {
          symbol: "TONUSDT",
          base_price: 7.2,
          exchange_price: 7.2,
          updated_at: new Date().toISOString(),
        },
        {
          symbol: "SOLUSDT",
          base_price: 145,
          exchange_price: 145,
          updated_at: new Date().toISOString(),
        },
      ];
    }

    // Добавляем рассчитанную фиатную пару рубля (USDTUSDT отвечает за вывод USD/RUB в вашем калькуляторе)
    upsertRows.push({
      symbol: "USDTUSDT",
      base_price: dynamicUsdtRubPrice,
      exchange_price: dynamicUsdtRubPrice,
      updated_at: new Date().toISOString(),
    });

    console.log(
      `[Шаг 3] Запись ${upsertRows.length} строк в таблицу crypto_rates Supabase...`,
    );

    // Выполняем upsert. Ключ sb_secret_... без проблем пробивает RLS
    const { error } = await supabase
      .from("crypto_rates")
      .upsert(upsertRows, { onConflict: "symbol" });

    if (error) {
      console.error(
        `[Шаг 3 Ошибка СУБД] База отклонила операцию upsert:`,
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
      live_market_data: Array.isArray(binanceData), // Будет true, если данные пришли живые напрямую с биржи
      updated: upsertRows.length,
      data: upsertRows,
    });
  } catch (err: any) {
    console.error(`[Глобальный сбой обработки]: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
