"use client";

import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  User,
  ArrowRightLeft,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const mockOrders = [
  {
    id: "TRX-9481",
    user: "Иван Иванов",
    from: { currency: "СБП RUB", amount: 100000 },
    to: { currency: "Tether TRC20 USDT", amount: 1069.51 },
    status: "pending",
    date: "14:32",
  },
  {
    id: "TRX-9480",
    user: "Алексей Смирнов",
    from: { currency: "Bitcoin BTC", amount: 0.05 },
    to: { currency: "Тинькофф RUB", amount: 310000 },
    status: "processing",
    date: "14:15",
  },
  {
    id: "TRX-9479",
    user: "Мария Сидорова",
    from: { currency: "Наличные USD", amount: 500 },
    to: { currency: "Tether ERC20 USDT", amount: 495 },
    status: "completed",
    date: "13:40",
  },
];

export default function OperatorDashboard() {
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "processing" | "completed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = mockOrders.filter((order) => {
    const matchesTab = activeTab === "all" || order.status === activeTab;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-zinc-900 font-sans">
      {/* Верхняя панель */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pl-14 md:pl-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
            Панель оператора
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Мониторинг транзакций Fast Trader Exchange
          </p>
        </div>

        <div className="flex items-center space-x-2.5 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-full self-start md:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-emerald-700">
            Обработка заявок активна
          </span>
        </div>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-none bg-[#FFDD2D] p-6 shadow-none flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-800 uppercase tracking-wide">
              Новые заявки
            </span>
            <Clock className="w-5 h-5 text-zinc-800" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">1</div>
        </Card>

        <Card className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-none flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
              В работе
            </span>
            <AlertCircle className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">1</div>
        </Card>

        <Card className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-none flex flex-col justify-between h-36 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
              Выполнено сегодня
            </span>
            <CheckCircle2 className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">24</div>
        </Card>
      </div>

      {/* Блок с таблицей */}
      <Card className="rounded-[32px] border border-[#FFDD2D] bg-white shadow-none p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
          <div className="flex flex-wrap gap-1 bg-zinc-100/70 p-1 rounded-2xl self-start">
            {[
              { id: "all", label: "Все" },
              { id: "pending", label: "Новые" },
              { id: "processing", label: "В работе" },
              { id: "completed", label: "Выполненные" },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-xs font-bold rounded-xl h-8 px-4 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white text-zinc-900 shadow-xs hover:bg-white"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-3 w-4 h-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Поиск по ID транзакции..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-10 rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-[#FFDD2D] text-sm font-medium"
            />
          </div>
        </div>

        <div className="overflow-hidden pt-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                  ID / Время
                </TableHead>
                <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                  Клиент
                </TableHead>
                <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                  Направление обмена
                </TableHead>
                <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                  Статус
                </TableHead>
                <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10 text-right">
                  Управление
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm font-medium">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="hover:bg-zinc-50/50 border-zinc-100"
                  >
                    <TableCell className="py-4 px-4">
                      <div className="font-bold text-zinc-900">{order.id}</div>
                      <div className="text-xs text-zinc-400 font-semibold mt-0.5">
                        {order.date}
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 shrink-0">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="font-semibold text-zinc-800 truncate max-w-[140px]">
                          {order.user}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-4">
                      <div className="flex items-center space-x-2 text-zinc-900 font-bold">
                        <span>
                          {order.from.amount}{" "}
                          <span className="text-xs text-zinc-400 font-semibold">
                            {order.from.currency}
                          </span>
                        </span>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        <span>
                          {order.to.amount}{" "}
                          <span className="text-xs text-zinc-400 font-semibold">
                            {order.to.currency}
                          </span>
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          order.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : order.status === "processing"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {order.status === "pending" && "Новая"}
                        {order.status === "processing" && "В работе"}
                        {order.status === "completed" && "Выполнена"}
                      </span>
                    </TableCell>

                    <TableCell className="py-4 px-4 text-right">
                      <Button
                        size="sm"
                        className="rounded-full h-9 px-5 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none text-xs transition-colors cursor-pointer"
                      >
                        Обработать
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-zinc-400 font-semibold"
                  >
                    Нет активных заявок
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
