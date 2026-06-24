import React from "react";
import { ShieldAlert, Settings, Database, Users } from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6">
        <h1 className="text-2xl font-bold tracking-tight text-red-900 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-600" />
          Здравствуйте! Вы админ.
        </h1>
        <p className="text-sm text-red-700 mt-1">
          Полный доступ к конфигурации системы, таблицам СУБД и логам
          безопасности.
        </p>
      </div>

      {/* Панель администратора */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Управление
            </span>
            <Settings className="h-4 w-4 text-zinc-400" />
          </div>
          <h3 className="font-bold text-zinc-900 text-sm">Настройки курсов</h3>
          <p className="text-xs text-zinc-500">
            Принудительное обновление API тикеров и ручные наценки.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              База данных
            </span>
            <Database className="h-4 w-4 text-zinc-400" />
          </div>
          <h3 className="font-bold text-zinc-900 text-sm">Просмотр таблиц</h3>
          <p className="text-xs text-zinc-500">
            Прямой контроль таблиц orders, profiles, crypto_rates.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Пользователи
            </span>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <h3 className="font-bold text-zinc-900 text-sm">Права и Роли</h3>
          <p className="text-xs text-zinc-500">
            Назначение операторов, блокировка аккаунтов, верификация.
          </p>
        </div>
      </div>
    </div>
  );
}
