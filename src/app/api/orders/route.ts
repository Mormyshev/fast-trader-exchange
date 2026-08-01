import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import {
  broadcastOrderEvent,
  ORDER_CREATED_EVENT,
} from "@/src/utils/supabase/broadcast";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const amountFrom = Number(body.amount_from);
    const amountTo = Number(body.amount_to);
    const walletTo = String(body.wallet_to || "").trim();

    if (!walletTo || Number.isNaN(amountFrom) || Number.isNaN(amountTo)) {
      return NextResponse.json(
        { error: "Некорректные данные заявки" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("orders")
      .insert([
        {
          user_id: user.id,
          status: "pending",
          operator_id: null,
          currency_from: body.currency_from || "RUB",
          currency_to: body.currency_to || "USDT_TRC20",
          amount_from: amountFrom,
          amount_to: amountTo,
          wallet_from: null,
          wallet_to: walletTo,
          tx_hash: null,
        },
      ])
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const order = data?.[0] ?? null;
    if (order) {
      // не блокируем ответ клиенту на broadcast
      void broadcastOrderEvent(ORDER_CREATED_EVENT, order);
    }

    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
