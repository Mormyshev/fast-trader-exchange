"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, PenLine } from "lucide-react";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import SlimScroll from "@/src/components/SlimScroll/SlimScroll";
import {
  SBP_BANKS,
  SBP_MANUAL_BANK_ID,
  findSbpBank,
  isManualSbpBank,
} from "@/src/utils/banks/sbp-banks";
import {
  formatSbpDestination,
  validateSbpDestination,
  type SbpPayoutMethod,
} from "@/src/utils/validation";

const METHODS: { id: SbpPayoutMethod; label: string }[] = [
  { id: "sbp", label: "По СБП" },
  { id: "card", label: "По карте" },
];

export default function SbpRequisitesFields({
  phone,
  bankId,
  method,
  bankName = "",
  onPhoneChange,
  onBankChange,
  onMethodChange,
  onBankNameChange,
  onBlur,
  hasError,
  errorMessage,
  variant = "default",
  lockBank = false,
}: {
  phone: string;
  bankId: string;
  method: SbpPayoutMethod;
  bankName?: string;
  onPhoneChange: (value: string) => void;
  onBankChange: (bankId: string) => void;
  onMethodChange: (method: SbpPayoutMethod) => void;
  onBankNameChange?: (bankName: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  errorMessage?: string;
  variant?: "default" | "staff";
  lockBank?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = findSbpBank(bankId);
  const staff = variant === "staff";
  const isCard = method === "card";
  const manualBank = isManualSbpBank(bankId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchMethod = (next: SbpPayoutMethod) => {
    if (next === method) return;
    onMethodChange(next);
    onPhoneChange("");
    setLocalError(null);
  };

  const shownError = errorMessage || localError;
  const invalid = Boolean(hasError || shownError);

  const checkDestination = (value: string, nextMethod = method) => {
    const digits = value.replace(/\D/g, "");
    if (nextMethod === "card" && digits.length >= 16) {
      const result = validateSbpDestination(value, nextMethod);
      setLocalError(result.ok ? null : result.error);
      return;
    }
    if (nextMethod === "card" && digits.length > 0 && digits.length < 16) {
      setLocalError(null);
      return;
    }
    setLocalError(null);
  };

  const fieldClass = invalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
    : staff
      ? "border-zinc-200 focus:border-[#FFDD2D]"
      : "border-zinc-200/80 dark:border-zinc-700 focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.3)]";

  const triggerClass = staff
    ? `w-full flex items-center justify-between gap-3 bg-zinc-50 border rounded-xl pl-5 pr-4 py-3 cursor-pointer hover:border-zinc-300 transition-colors text-left ${fieldClass}`
    : `w-full flex items-center justify-between gap-3 bg-white dark:bg-zinc-800 border rounded-full px-5 py-3.5 shadow-[0_0_15px_rgba(255,221,45,0.06)] cursor-pointer hover:border-zinc-300 transition-colors text-left ${fieldClass}`;

  const destClass = staff
    ? `w-full px-4 py-3 text-sm font-mono bg-zinc-50 border rounded-xl focus:outline-hidden text-zinc-900 ${fieldClass}`
    : `w-full bg-white border rounded-full px-6 py-4 text-sm font-bold text-zinc-900 dark:text-zinc-100 shadow-[0_0_15px_rgba(255,221,45,0.06)] placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-hidden transition-all tracking-wide ${fieldClass}`;

  return (
    <div className={staff ? "space-y-4" : "space-y-3"} ref={rootRef}>
      <div className={staff ? "space-y-1.5" : "space-y-2"}>
        {staff && (
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide pl-0.5">
            Способ оплаты
          </p>
        )}
        <div
          className={
            staff
              ? "grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1"
              : "grid grid-cols-2 gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 p-1"
          }
        >
          {METHODS.map((option) => {
            const active = method === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => switchMethod(option.id)}
                className={`h-10 text-xs font-bold transition-colors ${
                  staff ? "rounded-lg" : "rounded-full"
                } ${
                  active
                    ? "bg-[#FFDD2D] text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {lockBank ? null : (
      <div className={staff ? "space-y-1.5" : undefined}>
        {staff && (
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide pl-0.5">
            {isCard ? "Банк карты" : "Банк СБП"}
          </p>
        )}
        <div className="relative">
          <button type="button" onClick={() => setOpen((v) => !v)} className={triggerClass}>
            <div className="flex min-w-0 items-center gap-3">
              {selected ? (
                <>
                  <CurrencyIcon src={selected.iconSrc} alt={selected.name} size={28} />
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {selected.name}
                  </span>
                </>
              ) : manualBank ? (
                <>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFF4C2] text-[#C9A227]">
                    <PenLine className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    Ручной ввод
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-zinc-300 dark:text-zinc-600">
                  Выберите банк
                </span>
              )}
            </div>
            <div
              className={`flex items-center justify-center shrink-0 ${
                staff
                  ? "w-7 h-7 rounded-lg bg-white border border-zinc-200 text-zinc-600"
                  : "w-7 h-7 rounded-full bg-[#FFDD2D] text-zinc-950"
              }`}
            >
              <ChevronDown
                className={`w-4 h-4 stroke-[2.5] transition-transform ${open ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {open && (
            <div
              className={
                staff
                  ? "mt-2 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden"
                  : "absolute left-0 top-full mt-2 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 overflow-hidden"
              }
            >
              <SlimScroll maxHeightClassName="max-h-72">
                <div className="space-y-1 p-2 pr-3">
                  <button
                    type="button"
                    onClick={() => {
                      onBankChange(SBP_MANUAL_BANK_ID);
                      setOpen(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      manualBank
                        ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFF4C2] text-[#C9A227]">
                      <PenLine className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Ручной ввод
                    </span>
                  </button>
                  {SBP_BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => {
                        onBankChange(bank.id);
                        onBankNameChange?.("");
                        setOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                        bank.id === bankId
                          ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                      }`}
                    >
                      <CurrencyIcon src={bank.iconSrc} alt={bank.name} size={28} />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {bank.name}
                      </span>
                    </button>
                  ))}
                </div>
              </SlimScroll>
            </div>
          )}
        </div>
        {manualBank ? (
          <div className="space-y-1.5">
            {staff ? (
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide pl-0.5">
                Название банка
              </p>
            ) : (
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
                Название банка
              </p>
            )}
            <input
              type="text"
              value={bankName}
              onChange={(e) => onBankNameChange?.(e.target.value)}
              placeholder="Например: Ак Барс"
              maxLength={80}
              className={destClass}
              aria-label="Название банка"
            />
          </div>
        ) : null}
      </div>
      )}

      <div className={staff ? "space-y-1.5" : undefined}>
        {staff && (
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide pl-0.5">
            {isCard ? "Номер карты" : "Номер телефона"}
          </p>
        )}
        <input
          type={isCard ? "text" : "tel"}
          inputMode={isCard ? "numeric" : "tel"}
          autoComplete={isCard ? "cc-number" : "tel"}
          value={phone}
          onChange={(e) => {
            const next = formatSbpDestination(e.target.value, method);
            onPhoneChange(next);
            checkDestination(next);
          }}
          onBlur={() => {
            if (phone.trim()) {
              const result = validateSbpDestination(phone, method);
              setLocalError(result.ok ? null : result.error);
            }
            onBlur?.();
          }}
          placeholder={isCard ? "2202 0000 0000 0000" : "+7 (999) 000-00-00"}
          maxLength={isCard ? 23 : 18}
          className={destClass}
          required={!staff}
          aria-invalid={invalid}
        />
        {shownError ? (
          <p
            className={
              staff
                ? "text-[11px] font-semibold text-red-500 pl-1 pt-0.5"
                : "text-xs font-semibold text-red-500 pl-4 pt-1"
            }
          >
            {shownError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
