import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/utils/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("crypto_rates")
      .select("symbol, exchange_price");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? [], {
      headers: {
        // короткий кеш — меньше нагрузка, Realtime всё равно догонит изменения
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
