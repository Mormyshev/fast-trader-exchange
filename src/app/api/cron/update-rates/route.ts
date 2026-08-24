import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchMarketRates,
  ratesToUpsertRows,
} from "@/src/utils/market-rates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Чтение заголовка гарантированно пробивает кэш платформы на уровне ядра
  void request.headers.get("user-agent");

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

  const rates = await fetchMarketRates();
  const upsertRows = ratesToUpsertRows(rates);

  let dbError: string | undefined;
  try {
    const { error } = await supabase
      .from("crypto_rates")
      .upsert(upsertRows, { onConflict: "symbol" });
    if (error) dbError = error.message;
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    success: !dbError,
    source: rates.source,
    spread_note: "mid stored; client buy CBR+5 RUB, sell CBR-2 RUB per USDT",
    diagnostics: dbError ? { dbError } : "ok",
    updated: upsertRows.length,
    data: upsertRows,
  });
}
