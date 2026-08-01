"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderForm() {
  const router = useRouter();

  // Константы математики обмена
  const EXCHANGE_RATE = 75.6548; // 1 USDT = 75.6548 RUB
  const MIN_RUB = 300000;
  const MAX_RUB = 15000000;
  const MIN_USDT = 3965.3796;
  const MAX_USDT = 1982689.7962;

  // Состояния полей ввода
  const [rubAmount, setRubAmount] = useState<string>("300000");
  const [usdtAmount, setUsdtAmount] = useState<string>("3965.3796");
  const [isRubActive, setIsRubActive] = useState<boolean>(true);
  const [fio, setFio] = useState<string>("");
  const [wallet, setWallet] = useState<string>("T");
  const [city, setCity] = useState<string>("Москва");
  const [email, setEmail] = useState<string>("demo.user@example.com");
  const [telegram, setTelegram] = useState<string>("@demo_user");
  const [coupon, setCoupon] = useState<string>("");

  // Чекбоксы
  const [agreeAml, setAgreeAml] = useState<boolean>(false);
  const [dontRemember, setDontRemember] = useState<boolean>(false);

  // Состояние отправки формы (для индикатора загрузки)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Калькуляция: RUB -> USDT
  useEffect(() => {
    if (isRubActive) {
      const num = parseFloat(rubAmount);
      if (!isNaN(num)) {
        setUsdtAmount((num / EXCHANGE_RATE).toFixed(4));
      } else {
        setUsdtAmount("");
      }
    }
  }, [rubAmount]);

  // Калькуляция: USDT -> RUB
  useEffect(() => {
    if (!isRubActive) {
      const num = parseFloat(usdtAmount);
      if (!isNaN(num)) {
        setRubAmount((num * EXCHANGE_RATE).toFixed(2));
      } else {
        setRubAmount("");
      }
    }
  }, [usdtAmount]);

  // Маска для кошелька (всегда начинается с T)
  const handleWalletChange = (val: string) => {
    if (!val.startsWith("T")) {
      setWallet("T" + val.replace(/^T*/, ""));
    } else {
      setWallet(val);
    }
  };

  // Маска для Telegram (всегда начинается с @)
  const handleTelegramChange = (val: string) => {
    if (!val.startsWith("@")) {
      setTelegram("@" + val.replace(/^@*/, ""));
    } else {
      setTelegram(val);
    }
  };

  // Функция отправки заявки в Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация согласия с AML политикой
    if (!agreeAml) {
      alert("Необходимо принять условия AML политики.");
      return;
    }

    // Валидация лимитов сумм
    const finalRub = parseFloat(rubAmount);
    const finalUsdt = parseFloat(usdtAmount);

    if (isNaN(finalRub) || finalRub < MIN_RUB || finalRub > MAX_RUB) {
      alert(
        `Сумма RUB должна быть от ${MIN_RUB.toLocaleString("ru-RU")} до ${MAX_RUB.toLocaleString("ru-RU")}`,
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency_from: "RUB",
          currency_to: "USDT_TRC20",
          amount_from: finalRub,
          amount_to: finalUsdt,
          wallet_to: wallet,
        }),
      });
      const json = await res.json();

      if (res.status === 401) {
        alert("Для создания заявки необходимо авторизоваться на сайте!");
        return;
      }
      if (!res.ok) {
        throw new Error(json.error || "Не удалось создать заявку");
      }
      if (!json.order?.id) {
        throw new Error("Сервер не вернул ID заявки");
      }

      if (dontRemember) {
        setFio("");
        setWallet("T");
        setTelegram("@");
      }

      router.push(`/order/${json.order.id}`);
    } catch (err: any) {
      console.error("Order creation error:", err);
      alert(
        `Ошибка при оформлении заявки: ${err.message || "попробуйте позже"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="w-full antialiased select-none text-zinc-800 dark:text-zinc-100">
      <form
        onSubmit={handleSubmit}
        className="p-3 md:p-5 bg-[#FFFDE7] dark:bg-amber-950/20 rounded-[40px] shadow-xs"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-4 md:p-10 space-y-8 shadow-xs">
          {/* ================= СЕКЦИЯ 1: ОТДАЕТЕ ================= */}
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Отдаете
            </h2>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 pl-1">
              Курс: {EXCHANGE_RATE} RUB = 1 USDT
            </p>

            <div className="w-full sm:max-w-md flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-full px-5 py-3 shadow-[0_0_15px_rgba(255,221,45,0.08)] cursor-pointer hover:border-zinc-200 transition-colors">
              <div className="flex items-center space-x-3">
                <span className="text-xl leading-none">💵</span>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Наличные RUB
                </span>
              </div>
              <div className="w-7 h-7 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-950 shrink-0">
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-col text-right text-[11px] font-bold text-zinc-400 dark:text-zinc-500 pr-4">
                <span> min.: {MIN_RUB.toLocaleString("ru-RU")} RUB </span>
                <span> max.: {MAX_RUB.toLocaleString("ru-RU")} RUB </span>
              </div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Сумма <span className="text-red-500 font-bold ml-0.5"> * </span>{" "}
                :
              </label>
              <input
                type="number"
                step="any"
                value={rubAmount}
                onChange={(e) => {
                  setIsRubActive(true);
                  setRubAmount(e.target.value);
                }}
                className="w-full bg-[#FFFEEB] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-4 text-base font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                ФИО <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              <input
                type="text"
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.06)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all"
                required
              />
            </div>
          </div>

          <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full" />
          {/* ================= СЕКЦИЯ 2: ПОЛУЧАЕТЕ ================= */}
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Получаете
            </h2>

            <div className="w-full sm:max-w-md flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-full px-5 py-2.5 shadow-[0_0_15px_rgba(255,221,45,0.08)] cursor-pointer hover:border-zinc-200 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[#26A17B] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  ₮
                </div>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Tether TRC20 USDT
                </span>
              </div>
              <div className="w-7 h-7 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-950 shrink-0">
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-col text-right text-[11px] font-bold text-zinc-400 dark:text-zinc-500 pr-4">
                <span>min.: {MIN_USDT} USDT</span>
                <span>max.: {MAX_USDT} USDT</span>
              </div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Сумма <span className="text-red-500 font-bold ml-0.5"> * </span>{" "}
                :
              </label>
              <input
                type="number"
                step="any"
                value={usdtAmount}
                onChange={(e) => {
                  setIsRubActive(false);
                  setUsdtAmount(e.target.value);
                }}
                className="w-full bg-[#FFFEEB] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-4 text-base font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Адрес кошелька{" "}
                <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              <input
                type="text"
                value={wallet}
                onChange={(e) => handleWalletChange(e.target.value)}
                className="w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-bold text-zinc-900 dark:text-zinc-100 shadow-[0_0_15px_rgba(255,221,45,0.06)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all tracking-wide"
                required
              />
            </div>
          </div>

          <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full" />
          {/* ================= СЕКЦИЯ 3: ПЕРСОНАЛЬНЫЕ ДАННЫЕ ================= */}
          <div className="space-y-5">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
              Персональные данные
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Ваш город{" "}
                <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              <div className="w-full flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-6 py-3.5 shadow-[0_0_15px_rgba(255,221,45,0.05)] cursor-pointer hover:border-[#FFDD2D] transition-all">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {" "}
                  {city}{" "}
                </span>
                <ChevronDown className="w-4 h-4 text-amber-400 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                E-mail{" "}
                <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.06)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Telegram{" "}
                <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              <input
                type="text"
                value={telegram}
                onChange={(e) => handleTelegramChange(e.target.value)}
                className="w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.06)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 pl-4">
                Скидочный купон:
              </label>
              <input
                type="text"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                className="w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.04)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all"
              />
            </div>
          </div>

          <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full" />
          {/* ================= ЧЕКБОКСЫ И КНОПКА ОТПРАВКИ ================= */}
          <div className="space-y-6 pt-2">
            {/* Чекбокс 1: AML политика */}
            <div className="flex items-start space-x-3 group cursor-pointer select-none">
              <input
                type="checkbox"
                id="aml"
                checked={agreeAml}
                onChange={(e) => setAgreeAml(e.target.checked)}
                className="mt-1 w-4 h-4 rounded-sm border-zinc-300 text-[#FFDD2D] focus:ring-[#FFDD2D] accent-[#FFDD2D] cursor-pointer"
                required
              />
              <label
                htmlFor="aml"
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-relaxed cursor-pointer"
              >
                Я принимаю условия{" "}
                <span className="text-amber-400 hover:underline">
                  {" "}
                  AML политики{" "}
                </span>
                . Согласен (а) с{" "}
                <span className="underline decoration-zinc-400">
                  возвратом средств в случае приостановки обмена по причине AML
                </span>
                , риск вычета комиссии сети из суммы обмена при возврате
                осознаю.
              </label>
            </div>

            {/* Чекбокс 2: Не запоминать */}
            <div className="flex items-center space-x-3 group cursor-pointer select-none">
              <input
                type="checkbox"
                id="remember"
                checked={dontRemember}
                onChange={(e) => setDontRemember(e.target.checked)}
                className="w-4 h-4 rounded-sm border-zinc-300 text-[#FFDD2D] focus:ring-[#FFDD2D] accent-[#FFDD2D] cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 cursor-pointer"
              >
                Не запоминать введенные данные
              </label>
            </div>

            {/* Кнопка отправки Продолжить */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:max-w-xs bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold text-base py-4 rounded-full shadow-md active:scale-[0.99] transition-all flex items-center justify-center disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Создание заявки...
                  </>
                ) : (
                  "Продолжить"
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
