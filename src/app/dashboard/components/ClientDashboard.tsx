import React from "react";
import { ArrowLeftRight, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import ExchangeCalculator from "@/src/components/ExchangeCalculator/ExchangeCalculator";

export default function ClientDashboard({ userEmail }: { userEmail: string }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Быстрая статистика заявок клиента */}
      <ExchangeCalculator />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">В обработке</p>
            <p className="text-xl font-bold text-zinc-900">1 заявка</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Успешные обмены</p>
            <p className="text-xl font-bold text-zinc-900">12 операций</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-zinc-50 text-zinc-600">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Аккаунт</p>
            <p className="text-sm font-semibold text-zinc-900 truncate max-w-[160px]">
              {userEmail}
            </p>
          </div>
        </div>
      </div>

      {/* Блок со списком последних ордеров клиента */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">
          Ваши последние заявки на обмен
        </h2>
        <div className="text-center py-8 text-sm text-zinc-500 border border-dashed border-zinc-200 rounded-xl">
          У вас пока нет активных заявок.{" "}
          <span className="text-blue-600 font-medium cursor-pointer hover:underline">
            Создать обмен?
          </span>
        </div>
      </div>
    </div>
  );
}
