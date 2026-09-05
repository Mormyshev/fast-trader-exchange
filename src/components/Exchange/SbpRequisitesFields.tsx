"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import SlimScroll from "@/src/components/SlimScroll/SlimScroll";
import { SBP_BANKS, findSbpBank } from "@/src/utils/banks/sbp-banks";
import {
  formatSbpDestination,
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
  onPhoneChange,
  onBankChange,
  onMethodChange,
  onBlur,
  hasError,
  variant = "default",
  lockBank = false,
}: {
  phone: string;
  bankId: string;
  method: SbpPayoutMethod;
  onPhoneChange: (value: string) => void;
  onBankChange: (bankId: string) => void;
  onMethodChange: (method: SbpPayoutMethod) => void;
  onBlur?: () => void;
  hasError?: boolean;
  variant?: "default" | "staff";
  lockBank?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = findSbpBank(bankId);
  const staff = variant === "staff";
  const isCard = method === "card";

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
  };

  const fieldClass = hasError
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
                  {SBP_BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => {
                        onBankChange(bank.id);
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
          onChange={(e) =>
            onPhoneChange(formatSbpDestination(e.target.value, method))
          }
          onBlur={onBlur}
          placeholder={isCard ? "2202 0000 0000 0000" : "+7 (999) 000-00-00"}
          maxLength={isCard ? 23 : 18}
          className={destClass}
          required={!staff}
        />
      </div>
    </div>
  );
}
