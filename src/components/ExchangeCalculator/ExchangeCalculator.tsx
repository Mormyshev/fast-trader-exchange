"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeftRight, ChevronDown, Check } from "lucide-react";
import Link from "next/link";
// Импортируем вашу функцию создания клиента
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";

interface Currency {
  id: string;
  name: string;
  code: string;
  icon: string;
  bybitSymbol?: string;
}

interface RateRow {
  symbol: string;
  exchange_price: number;
}

export default function ExchangeCalculator() {
  const [supabase] = useState(() => createClient());

  const [sendAmount, setSendAmount] = useState<string>("100000");
  const [receiveAmount, setReceiveAmount] = useState<string>("");
  const [isSendActive, setIsSendActive] = useState<boolean>(true);
  const [rates, setRates] = useState<Record<string, number>>({});

  const fiatCurrencies: Currency[] = [
    {
      id: "sbp",
      name: "Система быстрых платежей (СБП)",
      code: "RUB",
      icon: "📲",
    },
    { id: "rub_cash", name: "Наличные RUB", code: "RUB", icon: "💵" },
    { id: "rub_sber", name: "Сбербанк RUB", code: "RUB", icon: "🟢" },
  ];

  const cryptoCurrencies: Currency[] = [
    {
      id: "usdt_trc20",
      name: "Tether TRC20 USDT",
      code: "USDT",
      icon: "🟢",
      bybitSymbol: "USDTUSDT",
    },
    {
      id: "btc",
      name: "Bitcoin BTC",
      code: "BTC",
      icon: "🪙",
      bybitSymbol: "BTCUSDT",
    },
    {
      id: "eth",
      name: "Ethereum ETH",
      code: "ETH",
      icon: "🔷",
      bybitSymbol: "ETHUSDT",
    },
    {
      id: "ton",
      name: "Toncoin TON",
      code: "TON",
      icon: "💎",
      bybitSymbol: "TONUSDT",
    },
    {
      id: "sol",
      name: "Solana SOL",
      code: "SOL",
      icon: "☀️",
      bybitSymbol: "SOLUSDT",
    },
  ];

  const [selectedSend, setSelectedSend] = useState<Currency>(fiatCurrencies[0]);
  const [selectedReceive, setSelectedReceive] = useState<Currency>(
    cryptoCurrencies[0],
  );
  const [isSendDropdownOpen, setIsSendDropdownOpen] = useState(false);
  const [isReceiveDropdownOpen, setIsReceiveDropdownOpen] = useState(false);

  const sendRef = useRef<HTMLDivElement>(null);
  const receiveRef = useRef<HTMLDivElement>(null);

  const isSendCrypto = cryptoCurrencies.some((c) => c.id === selectedSend.id);
  const isReceiveCrypto = cryptoCurrencies.some(
    (c) => c.id === selectedReceive.id,
  );

  const allowedSendList = isReceiveCrypto ? fiatCurrencies : cryptoCurrencies;
  const allowedReceiveList = isSendCrypto ? fiatCurrencies : cryptoCurrencies;

  const getLiveRate = (): number => {
    const usdtToRubRate = rates["USDTUSDT"] || 93.5;

    if (!isSendCrypto && isReceiveCrypto) {
      if (selectedReceive.bybitSymbol === "USDTUSDT") return 1 / usdtToRubRate;
      const cryptoPriceInUsdt = rates[selectedReceive.bybitSymbol || ""] || 0;
      return cryptoPriceInUsdt > 0
        ? 1 / (cryptoPriceInUsdt * usdtToRubRate)
        : 0;
    }

    if (isSendCrypto && !isReceiveCrypto) {
      if (selectedSend.bybitSymbol === "USDTUSDT") return usdtToRubRate;
      const cryptoPriceInUsdt = rates[selectedSend.bybitSymbol || ""] || 0;
      return cryptoPriceInUsdt * usdtToRubRate;
    }

    return 1;
  };

  const CURRENT_RATE = getLiveRate();
  const RESERVE = 50000000;

  // BFF: первичная загрузка через /api (сервер → Supabase), обновления — Realtime
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("/api/crypto-rates");
        const data = await res.json();
        if (!res.ok) {
          console.error("Ошибка чтения курсов:", data?.error || res.status);
          return;
        }
        if (Array.isArray(data)) {
          const formatted = data.reduce(
            (acc: Record<string, number>, item: RateRow) => ({
              ...acc,
              [item.symbol]: item.exchange_price,
            }),
            {} as Record<string, number>,
          );
          setRates(formatted);
        }
      } catch (err) {
        console.error("Ошибка чтения курсов:", err);
      }
    };

    fetchRates();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      channel = supabase
        .channel("live-calculator-rates")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "crypto_rates" },
          (payload) => {
            const updatedRow = payload.new as RateRow;
            setRates((prev) => ({
              ...prev,
              [updatedRow.symbol]: updatedRow.exchange_price,
            }));
          },
        );

      await subscribeWithAuth(supabase, channel);
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (isSendActive) {
      const num = parseFloat(sendAmount);
      setReceiveAmount(
        !isNaN(num) && CURRENT_RATE > 0 ? (num * CURRENT_RATE).toFixed(5) : "",
      );
    }
  }, [sendAmount, CURRENT_RATE, isSendActive]);

  useEffect(() => {
    if (!isSendActive) {
      const num = parseFloat(receiveAmount);
      setSendAmount(
        !isNaN(num) && CURRENT_RATE > 0 ? (num / CURRENT_RATE).toFixed(2) : "",
      );
    }
  }, [receiveAmount, CURRENT_RATE, isSendActive]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sendRef.current && !sendRef.current.contains(event.target as Node))
        setIsSendDropdownOpen(false);
      if (
        receiveRef.current &&
        !receiveRef.current.contains(event.target as Node)
      )
        setIsReceiveDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwap = () => {
    const temp = selectedSend;
    setSelectedSend(selectedReceive);
    setSelectedReceive(temp);
    setIsSendActive(true);
  };

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-zinc-900 border-2 border-[#FFDD2D] rounded-[32px] p-6 md:p-10 shadow-xs relative">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
          {/* Блок «Отправляете» */}
          <div className="w-full flex-1 space-y-3 relative" ref={sendRef}>
            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 pl-1">
              Отправляете
            </label>
            <button
              type="button"
              onClick={() => {
                setIsSendDropdownOpen(!isSendDropdownOpen);
                setIsReceiveDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-3 shadow-xs text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl leading-none">
                  {selectedSend.icon}
                </span>
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {selectedSend.name}
                </span>
              </div>
              <div className="w-6 h-6 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-900 shrink-0">
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${isSendDropdownOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isSendDropdownOpen && (
              <div className="absolute left-0 top-[88px] w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl py-2 z-50 max-h-60 overflow-y-auto">
                {allowedSendList.map((currency) => (
                  <button
                    key={currency.id}
                    type="button"
                    onClick={() => {
                      setSelectedSend(currency);
                      setIsSendDropdownOpen(false);

                      const isNewSendCrypto = cryptoCurrencies.some(
                        (c) => c.id === currency.id,
                      );
                      if (
                        isNewSendCrypto &&
                        cryptoCurrencies.some(
                          (c) => c.id === selectedReceive.id,
                        )
                      ) {
                        setSelectedReceive(fiatCurrencies[0]);
                      } else if (
                        !isNewSendCrypto &&
                        fiatCurrencies.some((c) => c.id === selectedReceive.id)
                      ) {
                        setSelectedReceive(cryptoCurrencies[0]);
                      }
                    }}
                    className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg leading-none">
                        {currency.icon}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {currency.name}
                      </span>
                    </div>
                    {selectedSend.id === currency.id && (
                      <Check className="w-4 h-4 text-zinc-900 dark:text-[#FFDD2D]" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <input
              type="number"
              value={sendAmount}
              onChange={(e) => {
                setIsSendActive(true);
                setSendAmount(e.target.value);
              }}
              className="w-full bg-[#FFFDE6] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-3.5 text-lg font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] transition-all"
            />
          </div>

          {/* Кнопка Реверса направления */}
          <div className="relative md:top-5 flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={handleSwap}
              className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-[#FFDD2D] shadow-md hover:scale-105 active:scale-95 transition-all rotate-90 md:rotate-0"
            >
              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Блок «Получаете» */}
          <div className="w-full flex-1 space-y-3 relative" ref={receiveRef}>
            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 pl-1">
              Получаете
            </label>
            <button
              type="button"
              onClick={() => {
                setIsReceiveDropdownOpen(!isReceiveDropdownOpen);
                setIsSendDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-3 shadow-xs text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl leading-none">
                  {selectedReceive.icon}
                </span>
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {selectedReceive.name}
                </span>
              </div>
              <div className="w-6 h-6 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-900 shrink-0">
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${isReceiveDropdownOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isReceiveDropdownOpen && (
              <div className="absolute left-0 top-[88px] w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl py-2 z-50 max-h-60 overflow-y-auto">
                {allowedReceiveList.map((currency) => (
                  <button
                    key={currency.id}
                    type="button"
                    onClick={() => {
                      setSelectedReceive(currency);
                      setIsReceiveDropdownOpen(false);
                    }}
                    className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg leading-none">
                        {currency.icon}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {currency.name}
                      </span>
                    </div>
                    {selectedReceive.id === currency.id && (
                      <Check className="w-4 h-4 text-zinc-900 dark:text-[#FFDD2D]" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <input
              type="number"
              value={receiveAmount}
              onChange={(e) => {
                setIsSendActive(false);
                setReceiveAmount(e.target.value);
              }}
              className="w-full bg-[#FFFDE6] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-3.5 text-lg font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] transition-all"
            />
          </div>
        </div>

        {/* Инфо панель */}
        <div className="mt-5 text-center md:text-right text-xs font-semibold text-zinc-400 dark:text-zinc-500 space-y-1 md:pr-4">
          <div>
            Курс: 1 {selectedReceive.code} ={" "}
            {CURRENT_RATE > 0 ? (1 / CURRENT_RATE).toFixed(4) : "0.0000"}{" "}
            {selectedSend.code}
          </div>
          <div>
            Резерв: {RESERVE.toLocaleString("ru-RU")} {selectedReceive.code}
          </div>
        </div>

        {/* Кнопка действия */}
        <div className="mt-8">
          <Link
            href={`/user/exchange?from=${selectedSend.id}&to=${selectedReceive.id}&amount=${sendAmount}`}
            className="inline-block text-center w-full bg-[#FFDD2D] text-zinc-900 font-bold text-base py-4 rounded-full hover:bg-[#e6c628] shadow-sm active:scale-[0.99] transition-all"
          >
            Продолжить
          </Link>
        </div>
      </div>
    </div>
  );
}
