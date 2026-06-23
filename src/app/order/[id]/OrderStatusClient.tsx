"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/utils/supabase/client";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Check,
} from "lucide-react";

interface OrderStatusClientProps {
  initialOrder: any;
}

export default function OrderStatusClient({
  initialOrder,
}: OrderStatusClientProps) {
  const [order, setOrder] = useState<any>(initialOrder);
  const [timeLeft, setTimeLeft] = useState<string>("15:00");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  const supabase = createClient();
  // 1. Подписка на Realtime-изменения заявки
  useEffect(() => {
    const channel = supabase
      .channel(`order-status-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          setOrder(payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  // 2. Логика таймера на 15 минут от времени создания заявки
  useEffect(() => {
    if (order.status !== "awaiting_payment") return;

    const calculateTimeLeft = () => {
      const createdAt = new Date(order.created_at).getTime();
      const expiresAt = createdAt + 15 * 60 * 1000; // +15 минут
      const now = new Date().getTime();
      const difference = expiresAt - now;

      if (difference <= 0) {
        setTimeLeft("00:00");
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const strMinutes = minutes < 10 ? `0${minutes}` : minutes;
      const strSeconds = seconds < 10 ? `0${seconds}` : seconds;

      setTimeLeft(`${strMinutes}:${strSeconds}`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [order.status, order.created_at]);
  // 3. Функция загрузки PDF чека в Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Пожалуйста, загрузите чек в формате PDF!");
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${order.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Загружаем файл в созданный бакет 'receipts'
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Получаем публичную ссылку на загруженный файл
      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(filePath);

      // Обновляем заявку в БД: сохраняем ссылку на чек
      const { error: updateError } = await supabase
        .from("orders")
        .update({ receipt_url: publicUrl })
        .eq("id", order.id);

      if (updateError) throw updateError;

      setUploadSuccess(true);
    } catch (err: any) {
      console.error("Полная ошибка Supabase Storage:", err);

      // Выводим максимум информации в alert для диагностики
      const errorMessage = err.message || err.error || JSON.stringify(err);
      alert(`Ошибка Supabase Storage: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Функция подтверждения оплаты от пользователя
  const handleConfirmPayment = async () => {
    // Проверяем, загружен ли чек (либо уже сохранен в базе, либо только что загружен)
    if (!order.receipt_url && !uploadSuccess) {
      alert("Пожалуйста, сначала прикрепите PDF-чек об оплате!");
      return;
    }

    try {
      // Меняем статус заявки на 'paid'
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid" }) // <-- Переводим в статус "Оплачено"
        .eq("id", order.id);

      if (error) throw error;

      alert("Заявка отправлена оператору на проверку! Ожидайте подтверждения.");
    } catch (err: any) {
      console.error("Ошибка смены статуса:", err);
      alert(`Не удалось отправить уведомление: ${err.message}`);
    }
  };

  return (
    <div className="p-0 md:p-4 w-full transition-all">
      <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 p-6 md:p-10 space-y-8 shadow-md text-zinc-800 dark:text-zinc-100">
        {/* Шапка статуса */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Заявка #{order.id.slice(0, 8)}...
            </h1>
            <p className="text-xs font-medium text-zinc-400 mt-1">
              Создана: {new Date(order.created_at).toLocaleString("ru-RU")}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Статус:
            </span>
            <span
              className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-xs border ${
                order.status === "pending"
                  ? "bg-amber-400 text-zinc-900 border-amber-500"
                  : order.status === "processing"
                    ? "bg-blue-500 text-white border-blue-600"
                    : order.status === "awaiting_payment"
                      ? "bg-purple-500 text-white border-purple-600"
                      : order.status === "completed"
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-rose-500 text-white border-rose-600"
              }`}
            >
              {order.status === "pending" && "В ожидании"}
              {order.status === "processing" && "В обработке"}
              {order.status === "awaiting_payment" && "На оплате"}
              {order.status === "completed" && "Выполнена"}
              {order.status === "cancelled" && "Отменена"}
            </span>
          </div>
        </div>

        {/* ДИНАМИЧЕСКИЙ БЛОК КОНТЕНТА */}
        <div className="py-2">
          {/* СТАТУС: PENDING */}
          {order.status === "pending" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-amber-400/25 dark:bg-amber-500/15 border border-amber-400/60 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm animate-pulse border border-amber-300">
                <Clock className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Ожидаем реквизиты от мерчанта
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Ваша заявка успешно создана и передана в систему
                  распределения. Первый освободившийся оператор отправит
                  реквизиты для оплаты.
                </p>
              </div>
              <div className="flex items-center space-x-2.5 text-sm font-bold text-zinc-800 dark:text-zinc-200 bg-white/80 dark:bg-zinc-800/80 px-4 py-2 rounded-full border border-amber-300 shadow-xs">
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                <span>Обычно это занимает не более 5 минут...</span>
              </div>
            </div>
          )}

          {/* СТАТУС: PROCESSING */}
          {order.status === "processing" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-blue-500/15 dark:bg-blue-500/10 border border-blue-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm border border-blue-300">
                <Loader2 className="w-7 h-7 animate-spin stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Заявка принята оператором
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Оператор взял ваш ордер в обработку. Пожалуйста, не закрывайте
                  страницу, реквизиты появятся здесь в течение 1–2 минут.
                </p>
              </div>
            </div>
          )}
          {/* СТАТУС: AWAITING_PAYMENT */}
          {order.status === "awaiting_payment" && (
            <div className="flex flex-col space-y-6 bg-purple-500/15 dark:bg-purple-500/10 border border-purple-400/40 p-6 md:p-10 rounded-[24px] shadow-sm animate-fade-in text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-300/30 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white dark:bg-zinc-800 text-purple-600 rounded-full flex items-center justify-center shadow-xs border border-purple-300">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                      Заявка ожидает вашей оплаты
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium">
                      Переведите точную сумму по указанным реквизитам.
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-2xl border-2 border-purple-400 shadow-sm flex items-center space-x-2 shrink-0 self-start sm:self-center">
                  <span className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                    Время на оплату:
                  </span>
                  <span className="font-mono font-black text-lg text-zinc-950 dark:text-zinc-50 tracking-wide">
                    {timeLeft}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-purple-300 shadow-xs space-y-2">
                <span className="block text-[11px] font-black uppercase text-purple-500 tracking-wider">
                  Инструкция и реквизиты мерчанта:
                </span>
                <p className="text-sm font-mono whitespace-pre-wrap font-bold text-zinc-900 dark:text-zinc-50 leading-relaxed bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  {order.payment_details}
                </p>
              </div>

              <div className="space-y-2">
                <span className="block text-[11px] font-black uppercase text-purple-500 tracking-wider">
                  Подтверждение платежа:
                </span>
                <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-purple-400/60 bg-white dark:bg-zinc-800 hover:bg-purple-50/50 dark:hover:bg-purple-950/10 rounded-2xl p-6 text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />

                  {isUploading ? (
                    <div className="space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
                      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        Загрузка файла чека в систему...
                      </p>
                    </div>
                  ) : order.receipt_url || uploadSuccess ? (
                    <div className="space-y-2 text-emerald-600 dark:text-emerald-400">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-400">
                        <Check className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider">
                        Чек успешно прикреплен!
                      </p>
                      <p className="text-[11px] text-zinc-400 font-mono max-w-xs truncate mx-auto">
                        PDF успешно загружен в хранилище
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-purple-400 group-hover:text-purple-600 mx-auto transition-colors" />
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                        Нажмите, чтобы прикрепить чек оплаты
                      </p>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                        Принимаются только файлы в формате PDF
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleConfirmPayment}
                  disabled={isUploading}
                  className="w-full sm:max-w-xs bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-200 text-white font-bold py-4 rounded-full shadow-md transition-all text-sm cursor-pointer tracking-wide uppercase text-center"
                >
                  Я оплатил, проверить транзакцию
                </button>
              </div>
            </div>
          )}
          {/* СТАТУС: COMPLETED */}
          {order.status === "completed" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm border border-emerald-300">
                <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Обмен успешно завершен!
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Средства были успешно отправлены на указанные вами реквизиты.
                  Спасибо, что выбрали Fast Trader Exchange!
                </p>
              </div>
            </div>
          )}

          {/* СТАТУС: CANCELLED */}
          {order.status === "cancelled" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-rose-500/15 dark:bg-rose-500/10 border border-rose-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm border border-rose-300">
                <XCircle className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Заявка отменена
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Данный обмен был отменен системой или оператором. Если у вас
                  возникли вопросы, свяжитесь с нашей службой поддержки в
                  Telegram.
                </p>
              </div>
            </div>
          )}
        </div>
        {order.status === "paid" && (
          <div className="flex flex-col items-center text-center space-y-5 bg-indigo-500/15 dark:bg-indigo-500/10 border border-indigo-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
              Платёж проверяется
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md">
              Мы получили ваш чек. Оператор сверяет поступление на баланс.
              Обычно это занимает от 2 до 10 минут.
            </p>
          </div>
        )}

        {/* Параметры обмена для сверки клиентом */}
        <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl p-6 space-y-4 text-sm">
          <h4 className="font-extrabold text-zinc-900 dark:text-zinc-50 pb-2 border-b border-zinc-200 dark:border-zinc-700 uppercase tracking-wider text-xs">
            Детали вашего обмена
          </h4>
          <div className="flex justify-between items-center py-0.5">
            <span className="font-bold text-zinc-400 uppercase text-xs">
              Вы отдаете:
            </span>
            <span className="font-black text-base text-zinc-900 dark:text-zinc-100 bg-zinc-200/50 dark:bg-zinc-800 px-3 py-1 rounded-lg">
              {Number(order.amount_from).toLocaleString("ru-RU")}{" "}
              {order.currency_from}
            </span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="font-bold text-zinc-400 uppercase text-xs">
              Вы получаете:
            </span>
            <span className="font-black text-base text-zinc-900 dark:text-zinc-100 bg-zinc-200/50 dark:bg-zinc-800 px-3 py-1 rounded-lg">
              {Number(order.amount_to).toFixed(4)}{" "}
              {order.currency_to.replace("_", " ")}
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <span className="font-bold text-zinc-400 uppercase text-xs shrink-0">
              Адрес зачисления (Ваш кошелек):
            </span>
            <span className="font-mono font-black text-xs bg-amber-400/10 text-zinc-900 dark:text-amber-400 border border-amber-400/40 px-3 py-1.5 rounded-xl break-all">
              {order.wallet_to}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
