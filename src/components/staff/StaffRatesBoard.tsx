"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import { CRYPTO_ASSETS } from "@/src/utils/exchange-currencies";
import { useAuth } from "@/src/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyBuySpread,
  applySellSpread,
  rateSourceVerifyUrl,
  shortRateSource,
} from "@/src/utils/market-rates";

type RateRow = {
  symbol: string;
  exchange_price: number;
  source?: string;
  cbr_offline?: boolean;
};

function formatRub(value: number): string {
  if (!(value > 0)) return "—";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function StaffRatesBoard() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [rates, setRates] = useState<Record<string, number>>({});
  const [sources, setSources] = useState<Record<string, string>>({});
  const [cbrOffline, setCbrOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [manualRate, setManualRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = async () => {
    const res = await fetch("/api/crypto-rates?fresh=1", {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) return;

    const nextRates: Record<string, number> = {};
    const nextSources: Record<string, string> = {};
    let offline = res.headers.get("X-Cbr-Offline") === "1";
    for (const item of data as RateRow[]) {
      nextRates[item.symbol] = item.exchange_price;
      if (item.source) nextSources[item.symbol] = item.source;
      if (item.symbol === "USDTUSDT" && item.cbr_offline) offline = true;
    }
    setRates(nextRates);
    setSources(nextSources);
    setCbrOffline(offline);
    if (nextRates.USDTUSDT > 0) {
      setManualRate(nextRates.USDTUSDT.toFixed(2));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await load();
      } catch (err) {
        console.error("Ошибка загрузки курсов:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    void run();
    const id = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const saveManual = async () => {
    setSaveError("");
    const rate = Number(manualRate.replace(",", "."));
    if (!Number.isFinite(rate)) {
      setSaveError("Введите число");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/usdt-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error || "Не удалось сохранить");
        return;
      }
      await load();
    } catch {
      setSaveError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const usdtMid = rates["USDTUSDT"] || 0;
  const buyUsdtRub = usdtMid > 0 ? applyBuySpread(usdtMid) : 0;
  const sellUsdtRub = usdtMid > 0 ? applySellSpread(usdtMid) : 0;

  const rows = CRYPTO_ASSETS.map((asset) => {
    const symbol = asset.bybitSymbol || "";
    const midUsdt = rates[symbol] || 0;
    const isUsdt = symbol === "USDTUSDT";
    const mid =
      isUsdt ? usdtMid : midUsdt > 0 && usdtMid > 0 ? midUsdt * usdtMid : 0;
    const buy = isUsdt
      ? buyUsdtRub
      : midUsdt > 0 && buyUsdtRub > 0
        ? midUsdt * buyUsdtRub
        : 0;
    const sell = isUsdt
      ? sellUsdtRub
      : midUsdt > 0 && sellUsdtRub > 0
        ? midUsdt * sellUsdtRub
        : 0;
    const rawSource = sources[symbol];

    return {
      id: asset.id,
      code: asset.code,
      iconSrc: asset.iconSrc,
      mid,
      buy,
      sell,
      sourceLabel: shortRateSource(rawSource),
      sourceFull: rawSource || "",
      sourceHref: rateSourceVerifyUrl(rawSource, symbol),
    };
  });

  return (
    <section className="rounded-2xl bg-white px-3 py-3 sm:px-4 sm:py-3.5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm sm:text-base font-bold text-zinc-900">Курсы</h2>
        <p className="text-[10px] sm:text-[11px] font-medium text-zinc-400">
          Курс — mid без спреда · покупка +5 ₽ · продажа −2 ₽
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div className="grid grid-cols-[minmax(5.5rem,1fr)_5.75rem_5.75rem_5.75rem_minmax(6.5rem,1.1fr)] gap-x-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
            <span>Актив</span>
            <span className="text-right">Курс</span>
            <span className="text-right">Покупка</span>
            <span className="text-right">Продажа</span>
            <span className="text-right">Источник</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(5.5rem,1fr)_5.75rem_5.75rem_5.75rem_minmax(6.5rem,1.1fr)] gap-x-2 items-center px-1 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CurrencyIcon src={row.iconSrc} alt={row.code} size={22} />
                  <span className="text-sm font-bold text-zinc-900">
                    {row.code}
                  </span>
                </div>
                <span className="text-right text-sm font-semibold text-zinc-900 tabular-nums">
                  {loaded ? formatRub(row.mid) : "…"}
                </span>
                <span className="text-right text-sm font-semibold text-emerald-700 tabular-nums">
                  {loaded ? formatRub(row.buy) : "…"}
                </span>
                <span className="text-right text-sm font-semibold text-rose-700 tabular-nums">
                  {loaded ? formatRub(row.sell) : "…"}
                </span>
                <div className="flex justify-end min-w-0">
                  {loaded && row.sourceHref ? (
                    <a
                      href={row.sourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={row.sourceFull}
                      className="inline-flex items-center gap-1 min-w-0 text-[11px] font-semibold text-[#C9A227] hover:underline"
                    >
                      <span className="truncate">{row.sourceLabel}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <span
                      className="text-[11px] font-semibold text-zinc-400 truncate"
                      title={row.sourceFull}
                    >
                      {loaded ? row.sourceLabel : "…"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && (
        <form
          className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 border-t border-zinc-100 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void saveManual();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-zinc-500">
              {cbrOffline
                ? "Задать курс USDT (ЦБ недоступен)"
                : "Резервный курс USDT, если ЦБ будет недоступен"}
            </span>
            <Input
              type="text"
              inputMode="decimal"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              className="mt-1 h-9 rounded-xl"
              placeholder="86.50"
            />
          </label>
          <Button
            type="submit"
            disabled={saving}
            className="h-9 rounded-full px-4 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
          {saveError ? (
            <p className="text-[11px] font-semibold text-rose-600 sm:pb-2">
              {saveError}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
