import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TermsContent from "./_components/TermsContent";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — Aurum Swap",
  description: "Условия использования сервиса Aurum Swap",
};

export default function TosPage() {
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
        Пользовательское соглашение
      </h1>

      <TermsContent />
    </div>
  );
}
