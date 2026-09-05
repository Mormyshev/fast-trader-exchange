import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import {
  broadcastOrderEvent,
  ORDER_CREATED_EVENT,
} from "@/src/utils/supabase/broadcast";
import { attachClientToOrder } from "@/src/utils/orders/attach-client";
import { formatVerifiedFio } from "@/src/utils/orders/client-info";
import {
  CLIENT_OPEN_ORDER_LIMIT,
  CLIENT_OPEN_ORDER_LIMIT_ERROR,
  countClientOpenOrders,
} from "@/src/utils/orders/client-limit";
import { cancelExpiredOrders } from "@/src/utils/orders/expire-orders";
import {
  isCryptoOrderCode,
  orderCodeToCurrencyId,
  validatePayoutDetails,
} from "@/src/utils/validation";
import {
  CLIENT_BLACKLISTED_CODE,
  formatClientBlacklistMessage,
  isProfileBlacklisted,
} from "@/src/utils/clients/blacklist";

const MIN_RUB = 1000;
const MAX_RUB = 15000000;

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
    const currencyTo = String(body.currency_to || "USDT_TRC20");
    const currencyFrom = String(body.currency_from || "RUB");

    if (Number.isNaN(amountFrom) || Number.isNaN(amountTo)) {
      return NextResponse.json(
        { error: "Некорректная сумма обмена" },
        { status: 400 },
      );
    }

    if (amountFrom <= 0 || amountTo <= 0) {
      return NextResponse.json(
        { error: "Сумма должна быть больше нуля" },
        { status: 400 },
      );
    }

    const receiveCrypto = isCryptoOrderCode(currencyTo);
    const sendCrypto = isCryptoOrderCode(currencyFrom);
    const rubAmount = sendCrypto ? amountTo : amountFrom;

    if (rubAmount < MIN_RUB || rubAmount > MAX_RUB) {
      return NextResponse.json(
        {
          error: `Сумма в рублях должна быть от ${MIN_RUB.toLocaleString("ru-RU")} до ${MAX_RUB.toLocaleString("ru-RU")}`,
        },
        { status: 400 },
      );
    }

    const walletCheck = validatePayoutDetails(
      walletTo,
      orderCodeToCurrencyId(currencyTo),
      receiveCrypto,
    );
    if (!walletCheck.ok) {
      return NextResponse.json({ error: walletCheck.error }, { status: 400 });
    }

    const normalizedWallet = walletCheck.value;

    const admin = createAdminClient();
    await cancelExpiredOrders(admin);

    const openCount = await countClientOpenOrders(admin, user.id);
    if (openCount >= CLIENT_OPEN_ORDER_LIMIT) {
      return NextResponse.json(
        { error: CLIENT_OPEN_ORDER_LIMIT_ERROR, code: "OPEN_ORDER_LIMIT" },
        { status: 409 },
      );
    }

    let { data: profile, error: profileError } = await admin
      .from("profiles")
      .select(
        "verification, email, last_name, first_name, middle_name, telegram, is_blacklisted, blacklist_reason",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      ({ data: profile } = await admin
        .from("profiles")
        .select(
          "verification, email, last_name, first_name, middle_name, telegram",
        )
        .eq("id", user.id)
        .maybeSingle());
    }

    if (isProfileBlacklisted(profile)) {
      return NextResponse.json(
        {
          error: formatClientBlacklistMessage(profile?.blacklist_reason),
          code: CLIENT_BLACKLISTED_CODE,
        },
        { status: 403 },
      );
    }

    if (profile?.verification !== "verified") {
      return NextResponse.json(
        {
          error:
            "Перед обменом необходимо пройти верификацию. Откройте профиль и отправьте анкету.",
        },
        { status: 403 },
      );
    }

    const verifiedFio = formatVerifiedFio(profile ?? {});
    const verifiedEmail =
      (typeof profile?.email === "string" ? profile.email.trim() : "") ||
      (typeof user.email === "string" ? user.email.trim() : "");
    const verifiedTelegram =
      typeof profile?.telegram === "string" ? profile.telegram.trim() : "";

    if (!verifiedFio || !verifiedEmail || !verifiedTelegram) {
      return NextResponse.json(
        {
          error:
            "В верификации не хватает ФИО, e-mail или Telegram. Обновите анкету в профиле.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("orders")
      .insert([
        {
          user_id: user.id,
          status: "pending",
          operator_id: null,
          currency_from: currencyFrom,
          currency_to: currencyTo,
          amount_from: amountFrom,
          amount_to: amountTo,
          wallet_from: null,
          wallet_to: normalizedWallet,
          tx_hash: null,
        },
      ])
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const order = data?.[0] ?? null;
    if (order) {
      void attachClientToOrder(admin, order).then((withClient) => {
        void broadcastOrderEvent(
          ORDER_CREATED_EVENT,
          withClient as Record<string, unknown>,
        );
      });
    }

    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
