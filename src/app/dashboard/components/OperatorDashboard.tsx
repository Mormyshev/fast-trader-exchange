import React from "react";
import { Shield, ListFilter, AlertCircle, CheckSquare } from "lucide-react";

export default function OperatorDashboard() {
  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
        <h1 className="text-2xl font-bold tracking-tight text-blue-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Здравствуйте! Вы оператор.
        </h1>
        <p className="text-sm text-blue-700 mt-1">
          Вам доступна обработка текущих заявок на обмен и управление
          реквизитами.
        </p>
      </div>

      {/* Рабочий стол оператора */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900">
              Очередь заявок (В обработке)
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-sm">
              3 новых
            </span>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex justify-between items-center text-sm">
            <div>
              <p className="font-semibold text-zinc-900">
                Ордер #1024 — Сбербанк ➡️ USDT
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Сумма: 50 000 RUB | Ожидает проверки оплаты
              </p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              Взять в работу
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">
            Ваши реквизиты
          </h2>
          <p className="text-xs text-zinc-500">
            Управляйте картами и кошельками, на которые клиенты отправляют
            средства.
          </p>
          <button className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-medium py-2 rounded-xl transition-colors">
            Настроить реквизиты
          </button>
        </div>
      </div>
    </div>
  );
}
