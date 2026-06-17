"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { useAuth } from "@/src/app/context/AuthContext";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function OperatorDashboard() {
  const supabase = createClient();
  const { user, role } = useAuth();

  const [newOrders, setNewOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Состояния для ввода реквизитов (ключ — id заявки)
  const [detailsInput, setDetailsInput] = useState<{ [key: string]: string }>({});

  // Загрузка заявок из базы
  const loadOrders = async () => {
    if (!user) return;

    // 1. Новые заявки (свободные)
    const { data: pending, error: pendingError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingError) {
      console.error("Ошибка загрузки новых заявок:", pendingError.message);
    }

    // 2. Заявки в работе у текущего оператора
    const { data: processing, error: processingError } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["processing", "awaiting_payment"])
      .eq("operator_id", user.id)
      .order("created_at", { ascending: false });

    if (processingError) {
      console.error("Ошибка загрузки моих заявок:", processingError.message);
    }

    if (pending) setNewOrders(pending);
    if (processing) setMyOrders(processing);
    setLoading(false);
  };
  useEffect(() => {
    // Ждем, пока загрузится пользователь и проверится его роль
    if (!user || (role !== "operator" && role !== "admin")) {
      if (role && role !== "operator" && role !== "admin") {
        setLoading(false); // Прекращаем загрузку, если доступ точно запрещен
      }
      return;
    }

    loadOrders();

    // Подписка на Realtime изменения таблицы заявок
    const channel = supabase
      .channel("operator-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          // При любом изменении в таблице обновляем списки
          loadOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  // Функция: Взять заявку в работу (с защитой от одновременного перехвата)
  const handleClaimOrder = async (orderId: string) => {
    if (!user) return;

    try {
      // Делаем атомарный запрос: обновляем только если operator_id СЕЙЧАС равен null
      const { data, error } = await supabase
        .from("orders")
        .update({
          operator_id: user.id,
          status: "processing", // Переводим в статус "В обработке"
        })
        .eq("id", orderId)
        .is("operator_id", null)
        .select(); // Добавляем select, чтобы проверить, применились ли изменения

      if (error) {
        alert("Ошибка при взятии заявки: " + error.message);
        return;
      }

      // Если данные не вернулись, значит кто-то другой успел нажать раньше (eq.is не сработал)
      if (!data || data.length === 0) {
        alert("Эту заявку уже забрал другой оператор!");
        return;
      }

      console.log("Заявка успешно перехвачена оператором:", user.id);
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  // Функция: Отправить реквизиты пользователю
  const handleSendDetails = async (orderId: string) => {
    const details = detailsInput[orderId];
    if (!details || details.trim() === "") {
      alert("Введите реквизиты для оплаты!");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        payment_details: details,
        status: "awaiting_payment", // Меняем статус на "Ожидание оплаты"
      })
      .eq("id", orderId);

    if (error) {
      alert("Не удалось отправить реквизиты: " + error.message);
    } else {
      // Очищаем инпут для этой заявки
      setDetailsInput((prev) => ({ ...prev, [orderId]: "" }));
    }
  };

  // Проверка прав доступа (защита страницы)
  if (role === "guest" || (role !== "operator" && role !== "admin" && !loading)) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-zinc-500">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
        <h2 className="text-xl font-bold">Доступ запрещен</h2>
        <p className="text-sm">
          Эта страница предназначена только для операторов и администраторов.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-12 antialiased text-zinc-800 dark:text-zinc-100">
      {/* СЕКЦИЯ 1: СВОБОДНЫЕ ЗАЯВКИ (ОЖИДАЮТ ОПЕРАТОРА) */}
      <div className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          Новые заявки в очереди ({newOrders.length})
        </h2>

        {newOrders.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl text-zinc-400 text-sm font-medium border border-dashed border-zinc-200 dark:border-zinc-700">
            Сейчас очередь пуста. Новые обмены появятся здесь мгновенно.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newOrders.map((order) => (
              <div
                key={order.id}
                className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      ID: ...{order.id.slice(0, 8)}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold">
                      Ожидает
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold">
                      Клиент отдает:{" "}
                      <span className="font-bold text-base">
                        {Number(order.amount_from).toLocaleString("ru-RU")}{" "}
                        {order.currency_from}
                      </span>
                    </p>
                    <p className="text-sm font-semibold text-zinc-500">
                      Должен получить:{" "}
                      <span>
                        {Number(order.amount_to).toFixed(4)} {order.currency_to}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleClaimOrder(order.id)}
                  className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-950 font-bold py-3 rounded-full transition-all text-sm cursor-pointer shadow-sm"
                >
                  Взять в работу
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* СЕКЦИЯ 2: ЗАЯВКИ В РАБОТЕ У ТЕКУЩЕГО ОПЕРАТОРА */}
      <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <h2 className="text-xl font-black uppercase tracking-wider text-blue-500">
          Мои active задачи ({myOrders.length})
        </h2>

        {myOrders.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl text-zinc-400 text-sm font-medium border border-dashed border-zinc-200 dark:border-zinc-700">
            У вас нет взятых заявок. Заберите active обмены из верхней очереди!
          </div>
        ) : (
          <div className="space-y-4">
            {myOrders.map((order) => (
              <div
                key={order.id}
                className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-blue-400/30 shadow-sm grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-center"
              >
                {/* Левая часть: Подробная информация */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-zinc-400">
                      ID: {order.id}
                    </span>
                    <span
                      className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                        order.status === "processing"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400"
                      }`}
                    >
                      {order.status === "processing" ? "В обработке" : "Выданы реквизиты"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl text-sm">
                    <div>
                      <span className="text-zinc-400 block text-xs font-bold">
                        КЛИЕНТ ОТДАЕТ:
                      </span>
                      <span className="font-black text-zinc-900 dark:text-zinc-100 text-base">
                        {Number(order.amount_from).toLocaleString("ru-RU")}{" "}
                        {order.currency_from}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-xs font-bold">
                        КОШЕЛЕК ПОЛУЧЕНИЯ (КЛИЕНТА):
                      </span>
                      <span className="font-mono text-xs font-bold block break-all bg-white dark:bg-zinc-800 px-2 py-1 rounded mt-1 border border-zinc-100 dark:border-zinc-700">
                        {order.wallet_to}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Правая часть: Форма отправки реквизитов */}
                <div className="space-y-3">
                  {order.status === "processing" ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-zinc-500 uppercase">
                        Реквизиты для оплаты клиенту:
                      </label>
                      <textarea
                        value={detailsInput[order.id] || ""}
                        onChange={(e) =>
                          setDetailsInput({
                            ...detailsInput,
                            [order.id]: e.target.value,
                          })
                        }
                        placeholder="Например: Сбербанк, Карта: 2202 0000 ... Получатель: Иван И."
                        className="w-full text-xs p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:border-blue-400 h-20 font-medium text-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        onClick={() => handleSendDetails(order.id)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-full transition-all text-xs cursor-pointer shadow-sm"
                      >
                        Отправить реквизиты клиенту
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-400/30 text-center space-y-1">
                      <CheckCircle2 className="w-5 h-5 text-purple-500 mx-auto" />
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-400">
                        Реквизиты отправлены
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Ожидаем подтверждения оплаты от пользователя...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
