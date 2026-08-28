"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import SlimScroll from "@/src/components/SlimScroll/SlimScroll";
import {
  CRYPTO_ASSETS,
  CRYPTO_CURRENCIES,
  FIAT_CURRENCIES,
  type ExchangeCurrency,
  formatAmount,
  formatRateLabel,
  getAssetForCurrency,
  getPairRate,
  isCryptoCurrency,
  resolveCurrencyVariant,
  sanitizeAmountInput,
} from "@/src/utils/exchange-currencies";
import { useAuth } from "@/src/app/context/AuthContext";
import { useAuthDialog } from "@/src/components/AuthDialog/AuthDialogProvider";

interface RateRow {
  symbol: string;
  exchange_price: number;
}

function DropdownPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.10)] dark:border-zinc-700 dark:bg-zinc-800">
      <SlimScroll>
        <div className="space-y-1 p-2">{children}</div>
      </SlimScroll>
    </div>
  );
}

function DropdownItem({
  active,
  iconSrc,
  label,
  onClick,
}: {
  active: boolean;
  iconSrc: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-colors ${
        active ? "bg-[#FFF4C2]" : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
      }`}
    >
      <CurrencyIcon src={iconSrc} alt={label} size={28} />
      <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {label}
      </span>
    </button>
  );
}

export default function ExchangeCalculator() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { role } = useAuth();
  const { requireAuth } = useAuthDialog();

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
  const receiveAsset = isReceiveCrypto
    ? getAssetForCurrency(selectedReceive)
    : null;

  const getLiveRate = (
    send: ExchangeCurrency = selectedSend,
    receive: ExchangeCurrency = selectedReceive,
  ): number => getPairRate(rates, send, receive);

  const CURRENT_RATE = getLiveRate();
  const RESERVE = 50000000;
  const MIN_RUB = 1000;

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

  const selectorClass =
    "flex h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-zinc-200 bg-white px-5 text-left dark:border-zinc-700 dark:bg-zinc-800";
  const amountInputClass = (invalid: boolean) =>
    `no-spin h-14 w-full rounded-full border-2 px-6 text-xl font-bold tabular-nums outline-none transition-colors ${
      invalid
        ? "border-rose-400 bg-rose-50 text-rose-600 focus:ring-2 focus:ring-rose-200"
        : "border-[#FFDD2D] bg-[#FFFEEB] text-zinc-900 focus:ring-2 focus:ring-[#FFDD2D]/40 dark:text-zinc-100"
    }`;

  return (
    <div className="w-full exchange-calculator">
      <div className="rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:bg-zinc-900 sm:p-7">
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
          <div className="min-w-0 space-y-3" ref={sendRef}>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Отдаёте
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSendDropdownOpen(!isSendDropdownOpen);
                  setIsReceiveDropdownOpen(false);
                }}
                className={selectorClass}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CurrencyIcon
                    src={selectedSend.iconSrc}
                    alt={selectedSend.name}
                    size={28}
                  />
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {sendAsset?.name ?? selectedSend.name}
                  </span>
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFDD2D] text-zinc-900">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isSendDropdownOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {isSendDropdownOpen ? (
                <DropdownPanel>
                  {isReceiveCrypto
                    ? FIAT_CURRENCIES.map((currency) => (
                        <DropdownItem
                          key={currency.id}
                          active={selectedSend.id === currency.id}
                          iconSrc={currency.iconSrc}
                          label={currency.name}
                          onClick={() => {
                            setSelectedSend(currency);
                            setIsSendDropdownOpen(false);
                          }}
                        />
                      ))
                    : CRYPTO_ASSETS.map((asset) => (
                        <DropdownItem
                          key={asset.id}
                          active={sendAsset?.id === asset.id}
                          iconSrc={asset.iconSrc}
                          label={asset.name}
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
                        />
                      ))}
                </DropdownPanel>
              ) : null}
            </div>
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
              className={amountInputClass(isBelowMin)}
            />
          </div>

          <div className="flex items-center justify-center md:pt-8">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Поменять направление"
              className="flex h-11 w-11 shrink-0 rotate-90 cursor-pointer items-center justify-center rounded-full border border-zinc-100 bg-white text-[#C9A227] shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-transform hover:scale-105 active:scale-95 md:rotate-0 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <ArrowLeftRight className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>

          <div className="min-w-0 space-y-3" ref={receiveRef}>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Получаете
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsReceiveDropdownOpen(!isReceiveDropdownOpen);
                  setIsSendDropdownOpen(false);
                }}
                className={selectorClass}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CurrencyIcon
                    src={selectedReceive.iconSrc}
                    alt={selectedReceive.name}
                    size={28}
                  />
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {receiveAsset?.name ?? selectedReceive.name}
                  </span>
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFDD2D] text-zinc-900">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isReceiveDropdownOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {isReceiveDropdownOpen ? (
                <DropdownPanel>
                  {isSendCrypto
                    ? FIAT_CURRENCIES.map((currency) => (
                        <DropdownItem
                          key={currency.id}
                          active={selectedReceive.id === currency.id}
                          iconSrc={currency.iconSrc}
                          label={currency.name}
                          onClick={() => {
                            setSelectedReceive(currency);
                            setIsReceiveDropdownOpen(false);
                          }}
                        />
                      ))
                    : CRYPTO_ASSETS.map((asset) => (
                        <DropdownItem
                          key={asset.id}
                          active={receiveAsset?.id === asset.id}
                          iconSrc={asset.iconSrc}
                          label={asset.name}
                          onClick={() => {
                            const next = resolveCurrencyVariant(asset.id);
                            if (!next) return;
                            setSelectedReceive(next);
                            setIsReceiveDropdownOpen(false);
                          }}
                        />
                      ))}
                </DropdownPanel>
              ) : null}
            </div>
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
              className={amountInputClass(isBelowMin)}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl bg-[#F4F5F7] dark:bg-zinc-800/80">
          <div
            className={`flex min-w-0 flex-col items-center justify-center px-2 py-3.5 text-center sm:px-4 ${
              isBelowMin ? "bg-rose-50 dark:bg-rose-950/25" : ""
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-[11px] ${
                isBelowMin ? "text-rose-400" : "text-zinc-400"
              }`}
            >
              Минимум
            </p>
            <p
              className={`mt-1.5 text-[13px] font-bold tabular-nums leading-tight sm:text-sm ${
                isBelowMin ? "text-rose-600" : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {MIN_RUB.toLocaleString("ru-RU")}{" "}
              <span className="font-semibold text-zinc-400">RUB</span>
            </p>
            {minCryptoEquivalent && cryptoCode ? (
              <p
                className={`mt-1 text-[11px] font-medium ${
                  isBelowMin ? "text-rose-400" : "text-zinc-400"
                }`}
              >
                ≈ {minCryptoEquivalent} {cryptoCode}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center border-x border-zinc-200/80 px-2 py-3.5 text-center sm:px-4 dark:border-zinc-700/80">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C9A227] sm:text-[11px]">
              Курс
            </p>
            <p className="mt-1.5 text-[13px] font-bold tabular-nums leading-snug text-zinc-900 sm:text-sm dark:text-zinc-100">
              {rateDisplayText.replace(/^Курс:\s*/, "")}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center px-2 py-3.5 text-center sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-[11px]">
              Резерв
            </p>
            <p className="mt-1.5 text-[13px] font-bold tabular-nums leading-tight text-zinc-900 sm:text-sm dark:text-zinc-100">
              {RESERVE.toLocaleString("ru-RU")}{" "}
              <span className="font-semibold text-zinc-400">
                {selectedReceive.code}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isBelowMin}
          onClick={() => {
            if (isBelowMin) return;
            const href = `/user/exchange?from=${selectedSend.id}&to=${selectedReceive.id}&amount=${sendAmount}`;
            if (role === "guest") {
              requireAuth(href);
              return;
            }
            router.push(href);
          }}
          className={`mt-5 h-12 w-full rounded-full text-sm font-bold transition-all ${
            isBelowMin
              ? "cursor-not-allowed bg-zinc-200 text-zinc-400"
              : "cursor-pointer bg-[#FFDD2D] text-zinc-900 shadow-sm hover:bg-[#e6c628] active:scale-[0.99]"
          }`}
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
