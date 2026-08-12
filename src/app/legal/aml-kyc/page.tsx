import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AmlKycContent from "../_components/AmlKycContent";

export const metadata: Metadata = {
  title: "AML / KYC — Aurum Swap",
  description: "Политика противодействия отмыванию доходов и процедуры KYC",
};

export default function AmlKycPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        На главную
      </Link>

      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
        AML / KYC
      </h1>

      <AmlKycContent />
    </div>
  );
}
