"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import SlimScroll from "@/src/components/SlimScroll/SlimScroll";
import {
  CRYPTO_ASSETS,
  CRYPTO_CURRENCIES,
  FIAT_CURRENCIES,
  type CryptoAsset,
  type ExchangeCurrency,
  formatAmount,
  formatRateLabel,
  getAssetForCurrency,
  getDefaultCryptoCurrency,
  getPairRate,
  isCryptoCurrency,
  resolveCurrencyVariant,
  sanitizeAmountInput,
} from "@/src/utils/exchange-currencies";
import CryptoNetworkSelect from "@/src/components/Exchange/CryptoNetworkSelect";

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

  const [selectedSend, setSelectedSend] = useState<ExchangeCurrency>(
    FIAT_CURRENCIES[0],
  );
  const [selectedReceive, setSelectedReceive] = useState<ExchangeCurrency>(
    CRYPTO_CURRENCIES[0],
  );
  const [isSendDropdownOpen, setIsSendDropdownOpen] = useState(false);
  const [isReceiveDropdownOpen, setIsReceiveDropdownOpen] = useState(false);

  const sendRef = useRef<HTMLDivElement>(null);
  const receiveRef = useRef<HTMLDivElement>(null);

  const isSendCrypto = isCryptoCurrency(selectedSend);
  const isReceiveCrypto = isCryptoCurrency(selectedReceive);
  const sendAsset = isSendCrypto ? getAssetForCurrency(selectedSend) : null;
  const receiveAsset = isReceiveCrypto ? getAssetForCurrency(selectedReceive) : null;

  const allowedSendList = isReceiveCrypto ? FIAT_CURRENCIES : CRYPTO_CURRENCIES;
  const allowedReceiveList = isSendCrypto ? FIAT_CURRENCIES : CRYPTO_CURRENCIES;

  const getLiveRate = (
    send: ExchangeCurrency = selectedSend,
    receive: ExchangeCurrency = selectedReceive,
  ): number => getPairRate(rates, send, receive);

  const CURRENT_RATE = getLiveRate();
  const RESERVE = 50000000;
  const MIN_RUB = 1000;

  /** Сумма сделки в рублях (фиатная сторона) */
  const rubDealAmount = isSendCrypto
    ? parseFloat(receiveAmount)
    : parseFloat(sendAmount);
  const isBelowMin =
    !Number.isFinite(rubDealAmount) ||
    rubDealAmount <= 0 ||
    rubDealAmount < MIN_RUB;

  const cryptoCode = isSendCrypto
    ? selectedSend.code
    : isReceiveCrypto
      ? selectedReceive.code
      : null;

  /** Эквивалент минимума в крипте для подсказки */
  const minCryptoEquivalent = (() => {
    if (!(CURRENT_RATE > 0) || !cryptoCode) return null;
    if (isSendCrypto) return formatAmount(MIN_RUB / CURRENT_RATE, true);
    if (isReceiveCrypto) return formatAmount(MIN_RUB * CURRENT_RATE, true);
    return null;
  })();

  const rateDisplayText = formatRateLabel(
    CURRENT_RATE,
    selectedSend,
    selectedReceive,
  ).replace("загружается…", "—");

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
    const pollId = window.setInterval(fetchRates, 60_000);

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
      window.clearInterval(pollId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (isSendActive) {
      const num = parseFloat(sendAmount);
      setReceiveAmount(
        !isNaN(num) && CURRENT_RATE > 0
          ? formatAmount(num * CURRENT_RATE, isReceiveCrypto)
          : "",
      );
    }
  }, [sendAmount, CURRENT_RATE, isSendActive, isReceiveCrypto]);

  useEffect(() => {
    if (!isSendActive) {
      const num = parseFloat(receiveAmount);
      setSendAmount(
        !isNaN(num) && CURRENT_RATE > 0
          ? formatAmount(num / CURRENT_RATE, isSendCrypto)
          : "",
      );
    }
  }, [receiveAmount, CURRENT_RATE, isSendActive, isSendCrypto]);

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
    // Крипту оставляем как есть, фиат пересчитываем под новый курс направления
    const cryptoAmount = isSendCrypto ? sendAmount : receiveAmount;
    const nextSend = selectedReceive;
    const nextReceive = selectedSend;
    const nextSendIsCrypto = isReceiveCrypto;
    const nextRate = getLiveRate(nextSend, nextReceive);
    const cryptoNum = parseFloat(cryptoAmount);

    setSelectedSend(nextSend);
    setSelectedReceive(nextReceive);

    if (nextSendIsCrypto) {
      setSendAmount(cryptoAmount);
      setReceiveAmount(
        !isNaN(cryptoNum) && nextRate > 0
          ? formatAmount(cryptoNum * nextRate, false)
          : "",
      );
      setIsSendActive(true);
    } else {
      setReceiveAmount(cryptoAmount);
      setSendAmount(
        !isNaN(cryptoNum) && nextRate > 0
          ? formatAmount(cryptoNum / nextRate, false)
          : "",
      );
      setIsSendActive(false);
    }
  };

  return (
    <div className="w-full exchange-calculator">
      <div className="bg-white dark:bg-zinc-900 border-2 border-[#FFDD2D] rounded-[32px] p-6 md:p-10 shadow-xs relative">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative">
          {/* Блок «Отправляете» */}
          <div className="w-full flex-1 space-y-3 relative" ref={sendRef}>
            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 pl-1">
              Отправляете
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSendDropdownOpen(!isSendDropdownOpen);
                  setIsReceiveDropdownOpen(false);
                }}
                className="w-full h-14 flex items-center justify-between gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 shadow-xs text-left overflow-hidden cursor-pointer"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <CurrencyIcon
                    src={selectedSend.iconSrc}
                    alt={selectedSend.name}
                    size={28}
                  />
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {sendAsset?.name ?? selectedSend.name}
                    {selectedSend.network
                      ? ` · ${selectedSend.network.shortLabel}`
                      : ""}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-900 shrink-0">
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${isSendDropdownOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {isSendDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <SlimScroll>
                    <div className="space-y-1 p-2 pr-3">
                      {isReceiveCrypto
                        ? FIAT_CURRENCIES.map((currency) => (
                            <button
                              key={currency.id}
                              type="button"
                              onClick={() => {
                                setSelectedSend(currency);
                                setIsSendDropdownOpen(false);
                              }}
                              className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors overflow-hidden cursor-pointer ${
                                selectedSend.id === currency.id
                                  ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                              }`}
                            >
                              <CurrencyIcon
                                src={currency.iconSrc}
                                alt={currency.name}
                                size={28}
                              />
                              <span className="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100 truncate">
                                {currency.name}
                              </span>
                            </button>
                          ))
                        : CRYPTO_ASSETS.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                const next = resolveCurrencyVariant(asset.id);
                                if (!next) return;
                                setSelectedSend(next);
                                setIsSendDropdownOpen(false);
                                if (
                                  isCryptoCurrency(next) &&
                                  isCryptoCurrency(selectedReceive)
                                ) {
                                  setSelectedReceive(FIAT_CURRENCIES[0]);
                                }
                              }}
                              className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors overflow-hidden cursor-pointer ${
                                sendAsset?.id === asset.id
                                  ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                              }`}
                            >
                              <CurrencyIcon
                                src={asset.iconSrc}
                                alt={asset.name}
                                size={28}
                              />
                              <span className="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100 truncate">
                                {asset.name}
                              </span>
                            </button>
                          ))}
                    </div>
                  </SlimScroll>
                </div>
              )}
            </div>
            {sendAsset && (
              <CryptoNetworkSelect
                asset={sendAsset}
                selectedVariantId={selectedSend.id}
                onSelectVariant={(variantId) => {
                  const next = resolveCurrencyVariant(sendAsset.id, variantId);
                  if (next) setSelectedSend(next);
                }}
                label="Сеть"
              />
            )}
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={sendAmount}
                onChange={(e) => {
                  const v = sanitizeAmountInput(e.target.value);
                  setIsSendActive(true);
                  setSendAmount(v);
                }}
                className={`no-spin w-full bg-[#FFFDE6] dark:bg-amber-950/10 border rounded-full px-6 py-3.5 text-lg font-bold focus:outline-hidden focus:ring-2 transition-all ${
                  isBelowMin
                    ? "border-red-400 text-red-600 dark:text-red-400 focus:ring-red-400"
                    : "border-amber-200/40 dark:border-amber-900/20 text-zinc-900 dark:text-zinc-100 focus:ring-[#FFDD2D]"
                }`}
              />
              {/* Абсолютно — не растягивает колонку и не ломает сетку */}
              <p
                className={`absolute left-4 top-[calc(100%+6px)] text-xs font-semibold whitespace-nowrap pointer-events-none ${
                  isBelowMin
                    ? "text-red-500"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                Мин.: {MIN_RUB.toLocaleString("ru-RU")} RUB
                {minCryptoEquivalent && cryptoCode
                  ? ` ≈ ${minCryptoEquivalent} ${cryptoCode}`
                  : ""}
              </p>
            </div>
          </div>

          {/* Кнопка Реверса направления — на уровне селекторов валют */}
          <div className="flex items-center justify-center shrink-0 md:mt-9">
            <button
              type="button"
              onClick={handleSwap}
              className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-[#FFDD2D] shadow-md hover:scale-105 active:scale-95 transition-all rotate-90 md:rotate-0 cursor-pointer"
            >
              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Блок «Получаете» */}
          <div className="w-full flex-1 space-y-3 relative" ref={receiveRef}>
            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 pl-1">
              Получаете
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsReceiveDropdownOpen(!isReceiveDropdownOpen);
                  setIsSendDropdownOpen(false);
                }}
                className="w-full h-14 flex items-center justify-between gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 shadow-xs text-left overflow-hidden cursor-pointer"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <CurrencyIcon
                    src={selectedReceive.iconSrc}
                    alt={selectedReceive.name}
                    size={28}
                  />
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {receiveAsset?.name ?? selectedReceive.name}
                    {selectedReceive.network
                      ? ` · ${selectedReceive.network.shortLabel}`
                      : ""}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-900 shrink-0">
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${isReceiveDropdownOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {isReceiveDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <SlimScroll>
                    <div className="space-y-1 p-2 pr-3">
                      {isSendCrypto
                        ? FIAT_CURRENCIES.map((currency) => (
                            <button
                              key={currency.id}
                              type="button"
                              onClick={() => {
                                setSelectedReceive(currency);
                                setIsReceiveDropdownOpen(false);
                              }}
                              className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors overflow-hidden cursor-pointer ${
                                selectedReceive.id === currency.id
                                  ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                              }`}
                            >
                              <CurrencyIcon
                                src={currency.iconSrc}
                                alt={currency.name}
                                size={28}
                              />
                              <span className="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100 truncate">
                                {currency.name}
                              </span>
                            </button>
                          ))
                        : CRYPTO_ASSETS.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                const next = resolveCurrencyVariant(asset.id);
                                if (!next) return;
                                setSelectedReceive(next);
                                setIsReceiveDropdownOpen(false);
                              }}
                              className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors overflow-hidden cursor-pointer ${
                                receiveAsset?.id === asset.id
                                  ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                              }`}
                            >
                              <CurrencyIcon
                                src={asset.iconSrc}
                                alt={asset.name}
                                size={28}
                              />
                              <span className="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100 truncate">
                                {asset.name}
                              </span>
                            </button>
                          ))}
                    </div>
                  </SlimScroll>
                </div>
              )}
            </div>
            {receiveAsset && (
              <CryptoNetworkSelect
                asset={receiveAsset}
                selectedVariantId={selectedReceive.id}
                onSelectVariant={(variantId) => {
                  const next = resolveCurrencyVariant(
                    receiveAsset.id,
                    variantId,
                  );
                  if (next) setSelectedReceive(next);
                }}
                label="Сеть"
              />
            )}
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={receiveAmount}
              onChange={(e) => {
                const v = sanitizeAmountInput(e.target.value);
                setIsSendActive(false);
                setReceiveAmount(v);
              }}
              className={`no-spin w-full bg-[#FFFDE6] dark:bg-amber-950/10 border rounded-full px-6 py-3.5 text-lg font-bold focus:outline-hidden focus:ring-2 transition-all ${
                isBelowMin
                  ? "border-red-400 text-red-600 dark:text-red-400 focus:ring-red-400"
                  : "border-amber-200/40 dark:border-amber-900/20 text-zinc-900 dark:text-zinc-100 focus:ring-[#FFDD2D]"
              }`}
            />
          </div>
        </div>

        {/* Инфо панель */}
        <div className="mt-8 text-center md:text-right text-xs font-semibold text-zinc-400 dark:text-zinc-500 space-y-1 md:pr-4">
          <div>{rateDisplayText}</div>
          <div>
            Резерв: {RESERVE} {selectedReceive.code}
          </div>
        </div>

        {/* Кнопка действия */}
        <div className="mt-8">
          {isBelowMin ? (
            <button
              type="button"
              disabled
              className="inline-block text-center w-full bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 font-bold text-base py-4 rounded-full cursor-not-allowed shadow-sm"
            >
              Продолжить
            </button>
          ) : (
            <Link
              href={`/user/exchange?from=${selectedSend.id}&to=${selectedReceive.id}&amount=${sendAmount}`}
              className="inline-block text-center w-full bg-[#FFDD2D] text-zinc-900 font-bold text-base py-4 rounded-full hover:bg-[#e6c628] shadow-sm active:scale-[0.99] transition-all cursor-pointer"
            >
              Продолжить
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
