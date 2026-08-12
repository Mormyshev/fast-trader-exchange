"use client";

import type { CryptoAsset } from "@/src/utils/exchange-currencies";

export default function CryptoNetworkSelect({
  asset,
  selectedVariantId,
  onSelectVariant,
  label = "Сеть",
}: {
  asset: CryptoAsset;
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  label?: string;
}) {
  if (!asset.networks.length) return null;

  const selectedVariant = asset.networks.find(
    (variant) => variant.id === selectedVariantId,
  );

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 pl-4">
        {label} <span className="text-red-500 font-bold ml-0.5">*</span> :
      </label>
      <div className="flex flex-wrap gap-2 pl-1">
        {asset.networks.map((variant) => {
          const active = selectedVariantId === variant.id;
          const singleNetwork = asset.networks.length === 1;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelectVariant(variant.id)}
              disabled={singleNetwork}
              className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${
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
      {selectedVariant && (
        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pl-4 leading-relaxed">
          {selectedVariant.network.description}
        </p>
      )}
    </div>
  );
}
