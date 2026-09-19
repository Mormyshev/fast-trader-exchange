import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { expireOrderIfNeeded } from "@/src/utils/orders/expire-orders";
import { orderPublicTitle } from "@/src/utils/orders/public-number";
import { formatOrderMoney } from "@/src/components/staff/OrderExchangePair";
import {
  findCurrencyByOrderCode,
  formatLockedOrderRate,
} from "@/src/utils/exchange-currencies";
import PrintReceiptButton from "./PrintReceiptButton";

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
}

function currencyLabel(orderCode: string) {
  const currency = findCurrencyByOrderCode(orderCode);
  const code = currency?.code ?? orderCode.replace(/_/g, " ");
  const network = currency?.network?.shortLabel;
  return network && network !== code ? `${code} · ${network}` : code;
}

function formatStamp(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrderReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const admin = createAdminClient();
  const [{ data: order }, { data: profile }] = await Promise.all([
    admin.from("orders").select("*").eq("id", id).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (!order) {
    notFound();
  }

  const isStaff =
    profile?.role === "operator" || profile?.role === "admin";
  if (isStaff) {
    redirect(`/operator/orders/${id}`);
  }
  if (order.user_id !== user.id) {
    notFound();
  }

  const fresh = await expireOrderIfNeeded(admin, order);
  if (fresh.status !== "completed") {
    redirect(`/order/${id}`);
  }

  const title = orderPublicTitle(fresh);
  const hasPayoutReceipt = Boolean(fresh.operator_receipt_url);

  return (
    <div className="min-h-screen bg-[#F4F5F7] print:bg-white">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link
            href={`/order/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="w-4 h-4" />
            К заявке
          </Link>
          <PrintReceiptButton />
        </div>

        <article className="rounded-3xl bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.04)] print:shadow-none print:rounded-none">
          <header className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Чек обмена
              </p>
              <h1 className="mt-1 text-xl font-bold text-zinc-900">{title}</h1>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                FastTraderExchange
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              Выполнена
            </span>
          </header>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400 font-semibold">Создана</dt>
              <dd className="font-medium text-zinc-800 tabular-nums text-right">
                {formatStamp(fresh.created_at)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400 font-semibold">Завершена</dt>
              <dd className="font-medium text-zinc-800 tabular-nums text-right">
                {formatStamp(fresh.updated_at || fresh.created_at)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400 font-semibold">Отдано</dt>
              <dd className="font-bold text-zinc-900 tabular-nums text-right">
                {formatOrderMoney(fresh.amount_from, fresh.currency_from)}{" "}
                {currencyLabel(fresh.currency_from)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400 font-semibold">Получено</dt>
              <dd className="font-bold text-zinc-900 tabular-nums text-right">
                {formatOrderMoney(fresh.amount_to, fresh.currency_to)}{" "}
                {currencyLabel(fresh.currency_to)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400 font-semibold">Курс</dt>
              <dd className="font-medium text-zinc-800 text-right">
                {formatLockedOrderRate(
                  fresh.amount_from,
                  fresh.amount_to,
                  fresh.currency_from,
                  fresh.currency_to,
                )}
              </dd>
            </div>
            {fresh.wallet_to ? (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400 font-semibold shrink-0">
                  Реквизиты получения
                </dt>
                <dd className="font-mono text-xs font-semibold text-zinc-800 break-all text-right">
                  {fresh.wallet_to}
                </dd>
              </div>
            ) : null}
          </dl>

          {hasPayoutReceipt ? (
            <div className="mt-6 rounded-2xl bg-[#FFF8D6] px-4 py-3 print:hidden">
              <p className="text-sm font-medium text-zinc-700">
                Есть подтверждение выплаты от оператора.
              </p>
              <a
                href={`/api/orders/${id}/operator-receipt`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-bold text-zinc-900 hover:underline"
              >
                Открыть подтверждение перевода
              </a>
            </div>
          ) : null}

          <p className="mt-6 text-[11px] font-medium leading-relaxed text-zinc-400">
            Документ подтверждает выполнение обмена FastTraderExchange. Сохраните
            его для своих записей.
          </p>
        </article>
      </main>
    </div>
  );
}
