"use client";

import type { CryptoAsset } from "@/src/utils/exchange-currencies";

export default function CryptoNetworkSelect({
  asset,
  selectedVariantId,
  onSelectVariant,
  label = "Сеть",
  compact = false,
}: {
  asset: CryptoAsset;
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  label?: string;
  compact?: boolean;
}) {
  if (!asset.networks.length) return null;

  const selectedVariant = asset.networks.find(
    (variant) => variant.id === selectedVariantId,
  );

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <label
        className={`block text-xs font-bold text-zinc-500 ${compact ? "" : "pl-4"}`}
      >
        {label}
        <span className="ml-0.5 font-bold text-red-500">*</span>
      </label>
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "pl-1"}`}>
        {asset.networks.map((variant) => {
          const active = selectedVariantId === variant.id;
          const singleNetwork = asset.networks.length === 1;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelectVariant(variant.id)}
              disabled={singleNetwork}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                singleNetwork
                  ? "cursor-default"
                  : "cursor-pointer hover:border-[#FFDD2D]"
              } ${
                active
                  ? "bg-[#FFDD2D] border-[#FFDD2D] text-zinc-900 shadow-sm"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {variant.network.shortLabel}
            </button>
          );
        })}
      </div>
      {!compact && selectedVariant ? (
        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pl-4 leading-relaxed">
          {selectedVariant.network.description}
        </p>
      ) : null}
    </div>
  );
}
