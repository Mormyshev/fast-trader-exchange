"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import { CRYPTO_ASSETS } from "@/src/utils/exchange-currencies";
import { applyBuySpread, applySellSpread } from "@/src/utils/market-rates";

type RateRow = { symbol: string; exchange_price: number };

const VISIBLE_COUNT = 2;

function formatRub(value: number): string {
  if (!(value > 0)) return "—";
  if (value >= 1000) {
    return value.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  });
}

export default function ExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/crypto-rates");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data) || cancelled) return;
        const formatted = (data as RateRow[]).reduce(
          (acc, item) => {
            acc[item.symbol] = item.exchange_price;
            return acc;
          },
          {} as Record<string, number>,
        );
        setRates(formatted);
      } catch (err) {
        console.error("Ошибка загрузки курсов:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const usdtMid = rates["USDTUSDT"] || 0;
  const buyUsdtRub = usdtMid > 0 ? applyBuySpread(usdtMid) : 0;
  const sellUsdtRub = usdtMid > 0 ? applySellSpread(usdtMid) : 0;

  const rows = CRYPTO_ASSETS.map((asset) => {
    const midUsdt = rates[asset.bybitSymbol || ""] || 0;
    const isUsdt = asset.bybitSymbol === "USDTUSDT";
    const buy =
      isUsdt
        ? buyUsdtRub
        : midUsdt > 0 && buyUsdtRub > 0
          ? midUsdt * buyUsdtRub
          : 0;
    const sell =
      isUsdt
        ? sellUsdtRub
        : midUsdt > 0 && sellUsdtRub > 0
          ? midUsdt * sellUsdtRub
          : 0;

    return {
      id: asset.id,
      code: asset.code,
      name: asset.name,
      iconSrc: asset.iconSrc,
      buy,
      sell,
    };
  });

  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_COUNT);
  const hiddenCount = rows.length - VISIBLE_COUNT;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <h3 className="text-zinc-900 font-bold text-xl mb-4">Курсы</h3>

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-[11px] font-bold text-zinc-400 px-1 mb-2">
        <span>Актив</span>
        <span className="text-right w-[5.5rem]">Покупка</span>
        <span className="text-right w-[5.5rem]">Продажа</span>
      </div>

      <div className="space-y-1">
        {visibleRows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center rounded-2xl px-2 py-2.5 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CurrencyIcon src={row.iconSrc} alt={row.code} size={28} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-900 truncate">
                  {row.code}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {row.name.replace(` ${row.code}`, "")}
                </div>
              </div>
            </div>
            <span className="text-right w-[5.5rem] text-sm font-semibold text-zinc-800 tabular-nums">
              {loaded ? formatRub(row.buy) : "…"}
            </span>
            <span className="text-right w-[5.5rem] text-sm font-semibold text-zinc-800 tabular-nums">
              {loaded ? formatRub(row.sell) : "…"}
            </span>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900 rounded-full hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          {expanded ? "Скрыть" : `Ещё ${hiddenCount}`}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
