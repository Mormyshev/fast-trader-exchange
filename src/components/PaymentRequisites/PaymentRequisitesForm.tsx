"use client";

import { formatPhoneInput } from "@/src/utils/validation";
import { formatCardInput } from "@/src/utils/orders/payment-details";

export default function PaymentRequisitesForm({
  card,
  phone,
  onCardChange,
  onPhoneChange,
}: {
  card: string;
  phone: string;
  onCardChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-[11px] font-bold text-zinc-500 uppercase pl-1 mb-1">
          Номер карты банка
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={card}
          onChange={(e) => onCardChange(formatCardInput(e.target.value))}
          placeholder="2202 20•• •••• 1234"
          className="w-full p-3 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#FFDD2D] text-zinc-900"
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-zinc-500 uppercase pl-1 mb-1">
          Номер телефона
        </label>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => onPhoneChange(formatPhoneInput(e.target.value))}
          placeholder="+7 (999) 000-00-00"
          className="w-full p-3 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#FFDD2D] text-zinc-900"
        />
      </div>
    </div>
  );
}
