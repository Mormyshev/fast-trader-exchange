"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeftRight, ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import SlimScroll from "@/src/components/SlimScroll/SlimScroll";
import {
  CRYPTO_ASSETS,
  CRYPTO_CURRENCIES,
  FIAT_CURRENCIES,
  type CryptoAsset,
  type ExchangeCurrency,
  findCurrencyById,
  formatAmount,
  formatRateLabel,
  getAssetForCurrency,
  getDefaultCryptoCurrency,
  getPairRate,
  isCryptoCurrency,
  isFiatCurrency,
  resolveCurrencyVariant,
  sanitizeAmountInput,
} from "@/src/utils/exchange-currencies";
import CryptoAssetPicker from "@/src/components/Exchange/CryptoAssetPicker";
import CryptoNetworkSelect from "@/src/components/Exchange/CryptoNetworkSelect";
import SbpRequisitesFields from "@/src/components/Exchange/SbpRequisitesFields";
import {
  isVerificationComplete,
  normalizeVerificationStatus,
  type VerificationStatus,
} from "@/src/utils/verification";
import {
  formatTelegramInput,
  formatWalletInput,
  getWalletPlaceholder,
  serializeSbpRequisites,
  validateOrderFormField,
  validateOrderFormFields,
  type OrderFormErrors,
} from "@/src/utils/validation";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";

type RateRow = { symbol: string; exchange_price: number };

function inputClass(hasError: boolean, base: string) {
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-200`
    : base;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs font-semibold text-red-500 pl-4 pt-1">{message}</p>
  );
}

function NetworkBadge({ currency }: { currency: ExchangeCurrency }) {
  if (!currency.network) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0">
      {currency.network.shortLabel}
    </span>
  );
}

function CurrencyPicker({
  selected,
  options,
  open,
  onToggle,
  onSelect,
  containerRef,
  showNetwork = false,
}: {
  selected: ExchangeCurrency;
  options: ExchangeCurrency[];
  open: boolean;
  onToggle: () => void;
  onSelect: (c: ExchangeCurrency) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showNetwork?: boolean;
}) {
  return (
    <div className="relative w-full sm:max-w-md" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-full px-5 py-3 shadow-[0_0_15px_rgba(255,221,45,0.08)] cursor-pointer hover:border-zinc-200 transition-colors text-left overflow-hidden"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <CurrencyIcon src={selected.iconSrc} alt={selected.name} size={28} />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate block">
              {selected.name}
            </span>
            {showNetwork && selected.network && (
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 truncate block">
                Сеть: {selected.network.label}
              </span>
            )}
          </div>
          {showNetwork && <NetworkBadge currency={selected} />}
        </div>
        <div className="w-7 h-7 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-950 shrink-0">
          <ChevronDown
            className={`w-4 h-4 stroke-[2.5] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 overflow-hidden">
          <SlimScroll>
            <div className="space-y-1 p-2 pr-3">
              {options.map((currency) => (
                <button
                  key={currency.id}
                  type="button"
                  onClick={() => onSelect(currency)}
                  className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors overflow-hidden cursor-pointer ${
                    selected.id === currency.id
                      ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  <CurrencyIcon
                    src={currency.iconSrc}
                    alt={currency.name}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate block">
                      {currency.name}
                    </span>
                    {showNetwork && currency.network && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block">
                        {currency.network.label}
                      </span>
                    )}
                  </div>
                  {showNetwork && <NetworkBadge currency={currency} />}
                </button>
              ))}
            </div>
          </SlimScroll>
        </div>
      )}
    </div>
  );
}

export default function OrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const MIN_RUB = 1000;
  const MAX_RUB = 15000000;

  const initialFrom =
    findCurrencyById(searchParams.get("from")) ?? FIAT_CURRENCIES[0];
  const initialToRaw =
    findCurrencyById(searchParams.get("to")) ?? CRYPTO_CURRENCIES[0];
  const initialTo =
    isCryptoCurrency(initialFrom) === isCryptoCurrency(initialToRaw)
      ? isCryptoCurrency(initialFrom)
        ? FIAT_CURRENCIES[0]
        : CRYPTO_CURRENCIES[0]
      : initialToRaw;
  const initialAmount = searchParams.get("amount") || "";

  const [selectedSend, setSelectedSend] =
    useState<ExchangeCurrency>(initialFrom);
  const [selectedReceive, setSelectedReceive] =
    useState<ExchangeCurrency>(initialTo);

  const [sendAmount, setSendAmount] = useState<string>(initialAmount);
  const [receiveAmount, setReceiveAmount] = useState<string>("");
  const [isSendActive, setIsSendActive] = useState<boolean>(true);
  const [rates, setRates] = useState<Record<string, number>>({});

  const [fio, setFio] = useState<string>("");
  const [wallet, setWallet] = useState<string>("");
  const [sbpBankId, setSbpBankId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [telegram, setTelegram] = useState<string>("");
  const [coupon, setCoupon] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<OrderFormErrors>({});

  const [agreeAml, setAgreeAml] = useState<boolean>(false);
  const [dontRemember, setDontRemember] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);

  const verified = isVerificationComplete(
    verificationStatus ?? "not_started",
  );

  const [isSendDropdownOpen, setIsSendDropdownOpen] = useState(false);
  const [isReceiveDropdownOpen, setIsReceiveDropdownOpen] = useState(false);
  const sendRef = useRef<HTMLDivElement>(null);
  const receiveRef = useRef<HTMLDivElement>(null);

  const isSendCrypto = isCryptoCurrency(selectedSend);
  const isReceiveCrypto = isCryptoCurrency(selectedReceive);
  const sendAsset = isSendCrypto ? getAssetForCurrency(selectedSend) : null;
  const receiveAsset = isReceiveCrypto ? getAssetForCurrency(selectedReceive) : null;

  const pairRate = getPairRate(rates, selectedSend, selectedReceive);

  const syncUrl = useCallback(
    (from: ExchangeCurrency, to: ExchangeCurrency, amount: string) => {
      const params = new URLSearchParams();
      params.set("from", from.id);
      params.set("to", to.id);
      if (amount) params.set("amount", amount);
      router.replace(`/user/exchange?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  // Синхронизируем URL при первом заходе без query (для блока «Обмен … на …»)
  useEffect(() => {
    if (!searchParams.get("from") || !searchParams.get("to")) {
      syncUrl(selectedSend, selectedReceive, sendAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) setVerificationStatus("not_started");
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setVerificationStatus(
            normalizeVerificationStatus(json.profile?.verification),
          );
        }
      } catch {
        if (!cancelled) setVerificationStatus("not_started");
      } finally {
        if (!cancelled) setVerificationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRates = async () => {
      try {
        const res = await fetch("/api/crypto-rates");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data) || cancelled) return;
        const formatted = data.reduce(
          (acc: Record<string, number>, item: RateRow) => {
            acc[item.symbol] = item.exchange_price;
            return acc;
          },
          {} as Record<string, number>,
        );
        setRates(formatted);
      } catch (err) {
        console.error("Ошибка загрузки курса:", err);
      }
    };

    void loadRates();
    const id = window.setInterval(loadRates, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (isSendActive && pairRate > 0) {
      const num = parseFloat(sendAmount);
      setReceiveAmount(
        !isNaN(num)
          ? formatAmount(num * pairRate, isReceiveCrypto)
          : "",
      );
    }
  }, [sendAmount, pairRate, isSendActive, isReceiveCrypto]);

  useEffect(() => {
    if (!isSendActive && pairRate > 0) {
      const num = parseFloat(receiveAmount);
      setSendAmount(
        !isNaN(num) ? formatAmount(num / pairRate, isSendCrypto) : "",
      );
    }
  }, [receiveAmount, pairRate, isSendActive, isSendCrypto]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sendRef.current && !sendRef.current.contains(event.target as Node)) {
        setIsSendDropdownOpen(false);
      }
      if (
        receiveRef.current &&
        !receiveRef.current.contains(event.target as Node)
      ) {
        setIsReceiveDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rubDealAmount = isSendCrypto
    ? parseFloat(receiveAmount)
    : parseFloat(sendAmount);

  const minReceive =
    pairRate > 0 && !isSendCrypto
      ? Number(formatAmount(MIN_RUB * pairRate, true) || 0)
      : pairRate > 0 && isSendCrypto
        ? Number(formatAmount(MIN_RUB / pairRate, true) || 0)
        : 0;
  const maxReceive =
    pairRate > 0 && !isSendCrypto
      ? Number(formatAmount(MAX_RUB * pairRate, true) || 0)
      : pairRate > 0 && isSendCrypto
        ? Number(formatAmount(MAX_RUB / pairRate, true) || 0)
        : 0;

  const handleSelectSend = (currency: ExchangeCurrency) => {
    setSelectedSend(currency);
    setIsSendDropdownOpen(false);

    let nextReceive = selectedReceive;
    const newIsCrypto = isCryptoCurrency(currency);
    if (newIsCrypto && isCryptoCurrency(selectedReceive)) {
      nextReceive = FIAT_CURRENCIES[0];
      setSelectedReceive(nextReceive);
    } else if (!newIsCrypto && isFiatCurrency(selectedReceive)) {
      nextReceive = getDefaultCryptoCurrency();
      setSelectedReceive(nextReceive);
    }
    setIsSendActive(true);
    setWallet("");
    setSbpBankId("");
    setFieldErrors((prev) => ({ ...prev, wallet: undefined }));
    syncUrl(currency, nextReceive, sendAmount);
  };

  const handleSelectSendAsset = (asset: CryptoAsset) => {
    const next = resolveCurrencyVariant(asset.id);
    if (!next) return;

    setSelectedSend(next);
    setIsSendDropdownOpen(false);

    if (isCryptoCurrency(next) && isCryptoCurrency(selectedReceive)) {
      setSelectedReceive(FIAT_CURRENCIES[0]);
    } else if (!isCryptoCurrency(next) && isFiatCurrency(selectedReceive)) {
      setSelectedReceive(getDefaultCryptoCurrency());
    }

    setIsSendActive(true);
    syncUrl(next, selectedReceive, sendAmount);
  };

  const handleSelectSendNetwork = (variantId: string) => {
    const asset = getAssetForCurrency(selectedSend);
    if (!asset) return;
    const next = resolveCurrencyVariant(asset.id, variantId);
    if (!next) return;
    setSelectedSend(next);
    syncUrl(next, selectedReceive, sendAmount);
  };

  const handleSelectReceiveAsset = (asset: CryptoAsset) => {
    const next = resolveCurrencyVariant(asset.id);
    if (!next) return;

    setSelectedReceive(next);
    setIsReceiveDropdownOpen(false);
    setIsSendActive(true);
    setWallet("");
    setSbpBankId("");
    setFieldErrors((prev) => ({ ...prev, wallet: undefined }));
    syncUrl(selectedSend, next, sendAmount);
  };

  const handleSelectReceiveNetwork = (variantId: string) => {
    const asset = getAssetForCurrency(selectedReceive);
    if (!asset) return;
    const next = resolveCurrencyVariant(asset.id, variantId);
    if (!next) return;
    setSelectedReceive(next);
    setWallet("");
    setSbpBankId("");
    setFieldErrors((prev) => ({ ...prev, wallet: undefined }));
    syncUrl(selectedSend, next, sendAmount);
  };

  const handleSelectReceive = (currency: ExchangeCurrency) => {
    setSelectedReceive(currency);
    setIsReceiveDropdownOpen(false);
    setIsSendActive(true);
    setWallet("");
    setSbpBankId("");
    setFieldErrors((prev) => ({ ...prev, wallet: undefined }));
    syncUrl(selectedSend, currency, sendAmount);
  };

  const getFormInput = useCallback(
    () => ({
      fio,
      wallet:
        selectedReceive.id === "sbp"
          ? serializeSbpRequisites(wallet, sbpBankId)
          : wallet,
      city: "",
      email,
      telegram,
      coupon,
      receiveCurrencyId: selectedReceive.id,
      isReceiveCrypto,
      isCashSelected: false,
      requireFio: !isSendCrypto,
    }),
    [
      fio,
      wallet,
      sbpBankId,
      email,
      telegram,
      coupon,
      selectedReceive.id,
      isReceiveCrypto,
      isSendCrypto,
    ],
  );

  const touchField = useCallback(
    (field: keyof OrderFormErrors) => {
      const result = validateOrderFormField(field, getFormInput());
      setFieldErrors((prev) => ({
        ...prev,
        [field]: result && !result.ok ? result.error : undefined,
      }));
    },
    [getFormInput],
  );

  const handleWalletChange = (val: string) => {
    setWallet(formatWalletInput(val, selectedReceive.id));
    if (fieldErrors.wallet) {
      setFieldErrors((prev) => ({ ...prev, wallet: undefined }));
    }
  };

  const handleTelegramChange = (val: string) => {
    setTelegram(formatTelegramInput(val));
    if (fieldErrors.telegram) {
      setFieldErrors((prev) => ({ ...prev, telegram: undefined }));
    }
  };

  const handleSwap = () => {
    const cryptoAmount = isSendCrypto ? sendAmount : receiveAmount;
    const nextSend = selectedReceive;
    const nextReceive = selectedSend;
    const nextSendIsCrypto = isReceiveCrypto;
    const nextRate = getPairRate(rates, nextSend, nextReceive);
    const cryptoNum = parseFloat(cryptoAmount);

    setSelectedSend(nextSend);
    setSelectedReceive(nextReceive);
    setWallet("");
    setSbpBankId("");
    setFieldErrors((prev) => ({ ...prev, wallet: undefined }));

    if (nextSendIsCrypto) {
      setSendAmount(cryptoAmount);
      setReceiveAmount(
        !isNaN(cryptoNum) && nextRate > 0
          ? formatAmount(cryptoNum * nextRate, false)
          : "",
      );
      setIsSendActive(true);
      syncUrl(nextSend, nextReceive, cryptoAmount);
    } else {
      const nextSendAmount =
        !isNaN(cryptoNum) && nextRate > 0
          ? formatAmount(cryptoNum / nextRate, false)
          : "";
      setReceiveAmount(cryptoAmount);
      setSendAmount(nextSendAmount);
      setIsSendActive(false);
      syncUrl(nextSend, nextReceive, nextSendAmount);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verified) {
      alert("Перед обменом необходимо пройти верификацию.");
      router.push("/user/profile");
      return;
    }

    if (!agreeAml) {
      alert("Необходимо принять условия AML политики.");
      return;
    }

    const finalSend = parseFloat(sendAmount);
    const finalReceive = parseFloat(receiveAmount);

    if (!(pairRate > 0) || isNaN(finalSend) || isNaN(finalReceive) || finalReceive <= 0) {
      alert("Курс ещё не загружен. Подождите пару секунд и попробуйте снова.");
      return;
    }

    if (
      !Number.isFinite(rubDealAmount) ||
      rubDealAmount < MIN_RUB ||
      rubDealAmount > MAX_RUB
    ) {
      alert(
        `Сумма в рублях должна быть от ${MIN_RUB.toLocaleString("ru-RU")} до ${MAX_RUB.toLocaleString("ru-RU")}`,
      );
      return;
    }

    const validation = validateOrderFormFields(getFormInput());
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      const firstError = Object.values(validation.errors).find(Boolean);
      if (firstError) alert(firstError);
      return;
    }

    setFieldErrors({});
    const payout = validation.values.wallet;

    const ok = await confirm({
      title: "Создать заявку на обмен?",
      description: `Отдаёте ${formatAmount(finalSend, isCryptoCurrency(selectedSend))} ${selectedSend.code} → получаете ${formatAmount(finalReceive, isCryptoCurrency(selectedReceive))} ${selectedReceive.code}. После создания заявку нужно будет оплатить в указанный срок.`,
      confirmLabel: "Создать заявку",
    });
    if (!ok) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency_from: selectedSend.orderCode,
          currency_to: selectedReceive.orderCode,
          amount_from: finalSend,
          amount_to: finalReceive,
          wallet_to: payout,
        }),
      });
      const json = await res.json();

      if (res.status === 401) {
        alert("Для создания заявки необходимо авторизоваться на сайте!");
        return;
      }
      if (res.status === 403) {
        alert(json.error || "Перед обменом необходимо пройти верификацию.");
        router.push("/user/profile");
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
        setWallet("");
        setSbpBankId("");
        setTelegram("");
        setEmail("");
      }

      router.push(`/order/${json.order.id}`);
    } catch (err: unknown) {
      console.error("Order creation error:", err);
      const message = err instanceof Error ? err.message : "попробуйте позже";
      alert(`Ошибка при оформлении заявки: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const receiveCode = selectedReceive.code;
  const sendCode = selectedSend.code;

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
              {formatRateLabel(pairRate, selectedSend, selectedReceive)}
            </p>

            {isReceiveCrypto ? (
              <CurrencyPicker
                selected={selectedSend}
                options={FIAT_CURRENCIES}
                open={isSendDropdownOpen}
                onToggle={() => {
                  setIsSendDropdownOpen((v) => !v);
                  setIsReceiveDropdownOpen(false);
                }}
                onSelect={handleSelectSend}
                containerRef={sendRef}
              />
            ) : isSendCrypto ? (
              <>
                <CryptoAssetPicker
                  assets={CRYPTO_ASSETS}
                  selected={selectedSend}
                  open={isSendDropdownOpen}
                  onToggle={() => {
                    setIsSendDropdownOpen((v) => !v);
                    setIsReceiveDropdownOpen(false);
                  }}
                  onSelectAsset={handleSelectSendAsset}
                  containerRef={sendRef}
                />
                {sendAsset && (
                  <CryptoNetworkSelect
                    asset={sendAsset}
                    selectedVariantId={selectedSend.id}
                    onSelectVariant={handleSelectSendNetwork}
                    label="Сеть отправки"
                  />
                )}
              </>
            ) : (
              <CurrencyPicker
                selected={selectedSend}
                options={FIAT_CURRENCIES}
                open={isSendDropdownOpen}
                onToggle={() => {
                  setIsSendDropdownOpen((v) => !v);
                  setIsReceiveDropdownOpen(false);
                }}
                onSelect={handleSelectSend}
                containerRef={sendRef}
              />
            )}

            <div className="space-y-1.5">
              <div className="flex flex-col text-right text-[11px] font-bold text-zinc-400 dark:text-zinc-500 pr-4">
                {!isSendCrypto ? (
                  <>
                    <span> min.: {MIN_RUB.toLocaleString("ru-RU")} RUB </span>
                    <span> max.: {MAX_RUB.toLocaleString("ru-RU")} RUB </span>
                  </>
                ) : (
                  <>
                    <span>
                      {" "}
                      min.:{" "}
                      {minReceive > 0
                        ? minReceive.toLocaleString("ru-RU")
                        : "—"}{" "}
                      {sendCode}{" "}
                    </span>
                    <span>
                      {" "}
                      max.:{" "}
                      {maxReceive > 0
                        ? maxReceive.toLocaleString("ru-RU")
                        : "—"}{" "}
                      {sendCode}{" "}
                    </span>
                  </>
                )}
              </div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Сумма <span className="text-red-500 font-bold ml-0.5"> * </span>{" "}
                :
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={sendAmount}
                onChange={(e) => {
                  setIsSendActive(true);
                  const next = sanitizeAmountInput(e.target.value);
                  setSendAmount(next);
                  syncUrl(selectedSend, selectedReceive, next);
                }}
                placeholder={isSendCrypto ? "0.00" : "100000"}
                className="no-spin w-full bg-[#FFFEEB] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-4 text-base font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
                required
              />
            </div>

            {!isSendCrypto && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                  ФИО <span className="text-red-500 font-bold ml-0.5"> * </span> :
                </label>
                <input
                  type="text"
                  value={fio}
                  onChange={(e) => {
                    setFio(e.target.value);
                    if (fieldErrors.fio) {
                      setFieldErrors((prev) => ({ ...prev, fio: undefined }));
                    }
                  }}
                  onBlur={() => touchField("fio")}
                  placeholder="Иванов Иван Иванович"
                  className={inputClass(
                    !!fieldErrors.fio,
                    "w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.06)] placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all",
                  )}
                  required
                />
                <FieldError message={fieldErrors.fio} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center py-1">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Поменять местами крипту и фиат"
              className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-[#FFDD2D] shadow-md hover:scale-105 active:scale-95 transition-all rotate-90 cursor-pointer"
            >
              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* ================= СЕКЦИЯ 2: ПОЛУЧАЕТЕ ================= */}
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Получаете
            </h2>

            {isSendCrypto ? (
              <CurrencyPicker
                selected={selectedReceive}
                options={FIAT_CURRENCIES}
                open={isReceiveDropdownOpen}
                onToggle={() => {
                  setIsReceiveDropdownOpen((v) => !v);
                  setIsSendDropdownOpen(false);
                }}
                onSelect={handleSelectReceive}
                containerRef={receiveRef}
              />
            ) : isReceiveCrypto ? (
              <>
                <CryptoAssetPicker
                  assets={CRYPTO_ASSETS}
                  selected={selectedReceive}
                  open={isReceiveDropdownOpen}
                  onToggle={() => {
                    setIsReceiveDropdownOpen((v) => !v);
                    setIsSendDropdownOpen(false);
                  }}
                  onSelectAsset={handleSelectReceiveAsset}
                  containerRef={receiveRef}
                />
                {receiveAsset && (
                  <CryptoNetworkSelect
                    asset={receiveAsset}
                    selectedVariantId={selectedReceive.id}
                    onSelectVariant={handleSelectReceiveNetwork}
                    label="Сеть получения"
                  />
                )}
              </>
            ) : (
              <CurrencyPicker
                selected={selectedReceive}
                options={FIAT_CURRENCIES}
                open={isReceiveDropdownOpen}
                onToggle={() => {
                  setIsReceiveDropdownOpen((v) => !v);
                  setIsSendDropdownOpen(false);
                }}
                onSelect={handleSelectReceive}
                containerRef={receiveRef}
              />
            )}

            <div className="space-y-1.5">
              <div className="flex flex-col text-right text-[11px] font-bold text-zinc-400 dark:text-zinc-500 pr-4">
                {isReceiveCrypto ? (
                  <>
                    <span>
                      min.:{" "}
                      {minReceive > 0
                        ? minReceive.toLocaleString("ru-RU")
                        : "—"}{" "}
                      {receiveCode}
                    </span>
                    <span>
                      max.:{" "}
                      {maxReceive > 0
                        ? maxReceive.toLocaleString("ru-RU")
                        : "—"}{" "}
                      {receiveCode}
                    </span>
                  </>
                ) : (
                  <>
                    <span> min.: {MIN_RUB.toLocaleString("ru-RU")} RUB </span>
                    <span> max.: {MAX_RUB.toLocaleString("ru-RU")} RUB </span>
                  </>
                )}
              </div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Сумма <span className="text-red-500 font-bold ml-0.5"> * </span>{" "}
                :
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={receiveAmount}
                onChange={(e) => {
                  setIsSendActive(false);
                  setReceiveAmount(sanitizeAmountInput(e.target.value));
                }}
                placeholder={isReceiveCrypto ? "0.00" : "100000"}
                className="no-spin w-full bg-[#FFFEEB] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-4 text-base font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                {isReceiveCrypto ? "Адрес кошелька" : "Реквизиты для получения"}{" "}
                {selectedReceive.network && (
                  <span className="text-amber-700 dark:text-amber-400 font-bold">
                    ({selectedReceive.network.shortLabel})
                  </span>
                )}{" "}
                <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              {selectedReceive.id === "sbp" ? (
                <SbpRequisitesFields
                  phone={wallet}
                  bankId={sbpBankId}
                  onPhoneChange={handleWalletChange}
                  onBankChange={(id) => {
                    setSbpBankId(id);
                    if (fieldErrors.wallet) {
                      setFieldErrors((prev) => ({ ...prev, wallet: undefined }));
                    }
                  }}
                  onBlur={() => touchField("wallet")}
                  hasError={!!fieldErrors.wallet}
                />
              ) : (
                <input
                  type="text"
                  value={wallet}
                  onChange={(e) => handleWalletChange(e.target.value)}
                  onBlur={() => touchField("wallet")}
                  placeholder={getWalletPlaceholder(selectedReceive.id)}
                  className={inputClass(
                    !!fieldErrors.wallet,
                    "w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-bold text-zinc-900 dark:text-zinc-100 shadow-[0_0_15px_rgba(255,221,45,0.06)] placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all tracking-wide",
                  )}
                  required
                />
              )}
              <FieldError message={fieldErrors.wallet} />
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
                E-mail{" "}
                <span className="text-red-500 font-bold ml-0.5"> * </span> :
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                onBlur={() => touchField("email")}
                placeholder="name@example.com"
                className={inputClass(
                  !!fieldErrors.email,
                  "w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.06)] placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all",
                )}
                required
              />
              <FieldError message={fieldErrors.email} />
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
                onBlur={() => touchField("telegram")}
                placeholder="@username"
                className={inputClass(
                  !!fieldErrors.telegram,
                  "w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.06)] placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all",
                )}
                required
              />
              <FieldError message={fieldErrors.telegram} />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 pl-4">
                Скидочный купон:
              </label>
              <input
                type="text"
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value);
                  if (fieldErrors.coupon) {
                    setFieldErrors((prev) => ({ ...prev, coupon: undefined }));
                  }
                }}
                onBlur={() => touchField("coupon")}
                placeholder="Промокод"
                className={inputClass(
                  !!fieldErrors.coupon,
                  "w-full bg-white border border-zinc-200/80 dark:border-zinc-700 rounded-full px-6 py-4 text-sm font-medium shadow-[0_0_15px_rgba(255,221,45,0.04)] placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)] transition-all",
                )}
              />
              <FieldError message={fieldErrors.coupon} />
            </div>
          </div>

          <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full" />
          {/* ================= ЧЕКБОКСЫ И КНОПКА ОТПРАВКИ ================= */}
          <div className="space-y-6 pt-2">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="aml"
                checked={agreeAml}
                onChange={(e) => setAgreeAml(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded-sm border-zinc-300 accent-[#FFDD2D] cursor-pointer"
                required
              />
              <label
                htmlFor="aml"
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-relaxed cursor-pointer"
              >
                Я принимаю условия{" "}
                <Link
                  href="/legal/aml-kyc"
                  className="text-amber-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  AML политики
                </Link>
                . Согласен (а) с{" "}
                <Link
                  href="/tos"
                  className="underline decoration-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  возвратом средств в случае приостановки обмена по причине AML
                </Link>
                , риск вычета комиссии сети из суммы обмена при возврате
                осознаю.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="remember"
                checked={dontRemember}
                onChange={(e) => setDontRemember(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded-sm border-zinc-300 accent-[#FFDD2D] cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-relaxed cursor-pointer"
              >
                Не запоминать введенные данные
              </label>
            </div>

            <div className="pt-4 space-y-3">
              {verificationLoading ? (
                <button
                  type="button"
                  disabled
                  className="w-full sm:max-w-xs bg-zinc-200 text-zinc-400 font-bold text-base py-4 rounded-full flex items-center justify-center cursor-not-allowed"
                >
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Проверка профиля...
                </button>
              ) : !verified ? (
                <>
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 max-w-xl">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <p>
                      {verificationStatus === "pending"
                        ? "Анкета на проверке. Обмен станет доступен после подтверждения администратором."
                        : verificationStatus === "rejected"
                          ? "Анкета отклонена. Исправьте данные в профиле и отправьте повторно."
                          : "Перед обменом необходимо пройти верификацию аккаунта."}
                    </p>
                  </div>
                  <Link
                    href="/user/profile"
                    className="w-full sm:max-w-xs inline-flex items-center justify-center bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 font-bold text-base py-4 rounded-full shadow-md active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {verificationStatus === "pending"
                      ? "Открыть статус верификации"
                      : verificationStatus === "rejected"
                        ? "Исправить анкету"
                        : "Пройти верификацию"}
                  </Link>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !(pairRate > 0)}
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
              )}
            </div>
          </div>
        </div>
      </form>
      <ConfirmDialogHost />
    </div>
  );
}
