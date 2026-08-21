"use client";

import {
  formatWalletInput,
  getWalletPlaceholder,
  isCryptoOrderCode,
  orderCodeToCurrencyId,
} from "@/src/utils/validation";
import PaymentRequisitesForm from "@/src/components/PaymentRequisites/PaymentRequisitesForm";

export default function OperatorPayInForm({
  currencyFrom,
  card,
  phone,
  wallet,
  onCardChange,
  onPhoneChange,
  onWalletChange,
}: {
  currencyFrom: string;
  card: string;
  phone: string;
  wallet: string;
  onCardChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onWalletChange: (value: string) => void;
}) {
  if (isCryptoOrderCode(currencyFrom)) {
    const currencyId = orderCodeToCurrencyId(currencyFrom);
    const network = currencyFrom.replace(/_/g, " ");
    return (
      <div>
        <label className="block text-[11px] font-bold text-zinc-500 uppercase pl-1 mb-1">
          Адрес кошелька ({network})
        </label>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={wallet}
          onChange={(e) =>
            onWalletChange(formatWalletInput(e.target.value, currencyId))
          }
          placeholder={getWalletPlaceholder(currencyId)}
          className="w-full p-3 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#FFDD2D] text-zinc-900"
        />
        <p className="text-[11px] text-zinc-400 font-medium pl-1 mt-1.5">
          Клиент отправит {network} на этот адрес
        </p>
      </div>
    );
  }

  return (
    <PaymentRequisitesForm
      card={card}
      phone={phone}
      onCardChange={onCardChange}
      onPhoneChange={onPhoneChange}
    />
  );
}
