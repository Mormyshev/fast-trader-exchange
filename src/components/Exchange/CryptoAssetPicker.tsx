"use client";

import { ChevronDown } from "lucide-react";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import SlimScroll from "@/src/components/SlimScroll/SlimScroll";
import type { CryptoAsset, ExchangeCurrency } from "@/src/utils/exchange-currencies";
import { getAssetForCurrency } from "@/src/utils/exchange-currencies";

function NetworkBadge({ currency }: { currency: ExchangeCurrency }) {
  if (!currency.network) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0">
      {currency.network.shortLabel}
    </span>
  );
}

export default function CryptoAssetPicker({
  assets,
  selected,
  open,
  onToggle,
  onSelectAsset,
  containerRef,
}: {
  assets: CryptoAsset[];
  selected: ExchangeCurrency;
  open: boolean;
  onToggle: () => void;
  onSelectAsset: (asset: CryptoAsset) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const selectedAsset = getAssetForCurrency(selected);

  return (
    <div className="relative w-full sm:max-w-md" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-full px-5 py-3 shadow-[0_0_15px_rgba(255,221,45,0.08)] cursor-pointer hover:border-zinc-200 transition-colors text-left"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <CurrencyIcon
            src={selected.iconSrc}
            alt={selected.name}
            size={28}
          />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate block">
              {selectedAsset?.name ?? selected.name}
            </span>
            {selected.network && (
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 truncate block">
                Сеть: {selected.network.label}
              </span>
            )}
          </div>
          <NetworkBadge currency={selected} />
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
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelectAsset(asset)}
                  className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors overflow-hidden cursor-pointer ${
                    selectedAsset?.id === asset.id
                      ? "bg-[#FFF3B0] dark:bg-amber-500/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  <CurrencyIcon
                    src={asset.iconSrc}
                    alt={asset.name}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate block">
                      {asset.name}
                    </span>
                    {asset.networks.length > 1 && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block">
                        {asset.networks.length} сети:{" "}
                        {asset.networks
                          .map((variant) => variant.network.shortLabel)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </SlimScroll>
        </div>
      )}
    </div>
  );
}
