import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/utils/chat/auth";
import {
  fetchCbrUsdRubHit,
  USDT_MANUAL_SYMBOL,
} from "@/src/utils/market-rates";

const MIN_RATE = 1;
const MAX_RATE = 500;

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const raw = body && typeof body.rate === "number" ? body.rate : Number(body?.rate);
    const rate = Number(raw.toFixed(2));
    if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
      return NextResponse.json(
        { error: `Укажите курс USDT от ${MIN_RATE} до ${MAX_RATE} ₽` },
        { status: 400 },
      );
    }

    const updated_at = new Date().toISOString();
    const manualRow = {
      symbol: USDT_MANUAL_SYMBOL,
      base_price: rate,
      exchange_price: rate,
      updated_at,
    };
    const rows = [manualRow];

    const cbrHit = await fetchCbrUsdRubHit();
    if (!cbrHit) {
      rows.push({
        symbol: "USDTUSDT",
        base_price: rate,
        exchange_price: rate,
        updated_at,
      });
    }

    const { error } = await actor.admin
      .from("crypto_rates")
      .upsert(rows, { onConflict: "symbol" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      rate,
      appliedNow: !cbrHit,
      cbr_offline: !cbrHit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
