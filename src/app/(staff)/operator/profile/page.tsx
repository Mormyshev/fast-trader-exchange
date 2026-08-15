"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import { validateOperatorPseudonym } from "@/src/utils/validation";

export default function OperatorProfilePage() {
  const [pseudonym, setPseudonym] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/operator/profile");
        const data = await res.json();
        if (res.ok && data.profile?.operator_pseudonym) {
          setPseudonym(data.profile.operator_pseudonym);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    const check = validateOperatorPseudonym(pseudonym);
    if (!check.ok) {
      setFieldError(check.error);
      return;
    }

    setSaving(true);
    setError(null);
    setFieldError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/operator/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_pseudonym: check.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      const savedPseudonym = data.profile.operator_pseudonym;
      setPseudonym(savedPseudonym);
      setSaved(true);
      window.dispatchEvent(
        new CustomEvent("operator-profile-updated", {
          detail: { pseudonym: savedPseudonym },
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            Профиль оператора
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Псевдоним отображается клиенту в чате поддержки вместе с
            мини-аватаром.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-[#FFFDE7] border border-amber-200/60 p-4">
          <OperatorAvatar name={pseudonym || "О"} />
          <div>
            <p className="text-xs text-zinc-500">Как видит клиент</p>
            <p className="text-base font-bold text-zinc-900">
              {pseudonym.trim() || "Оператор"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="operator-pseudonym"
            className="text-sm font-semibold text-zinc-800"
          >
            Псевдоним
          </label>
          <input
            id="operator-pseudonym"
            value={pseudonym}
            onChange={(e) => {
              setPseudonym(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            onBlur={() => {
              const check = validateOperatorPseudonym(pseudonym);
              setFieldError(check.ok ? null : check.error);
            }}
            placeholder="Например: Михаил"
            maxLength={40}
            className={`w-full rounded-full border px-5 py-3 text-sm focus:outline-none focus:border-[#FFDD2D] ${
              fieldError ? "border-red-400" : "border-zinc-200"
            }`}
          />
          {fieldError && (
            <p className="text-xs font-medium text-red-500">{fieldError}</p>
          )}
        </div>

        {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
        {saved && (
          <p className="text-sm text-emerald-600 font-medium">Сохранено</p>
        )}

        <Button
          onClick={() => void handleSave()}
          disabled={saving || !pseudonym.trim()}
          className="w-full sm:w-auto rounded-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 font-bold px-8"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
      </div>
    </div>
  );
}
