import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Section = {
  title: string;
  content: React.ReactNode;
};

type LegalArticleProps = {
  title: string;
  description?: string;
  updatedAt?: string;
  sections: Section[];
};

export default function LegalArticle({
  title,
  description,
  updatedAt = "12 августа 2026",
  sections,
}: LegalArticleProps) {
  return (
    <article className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        На главную
      </Link>

      <header className="space-y-3 border-b border-zinc-100 dark:border-zinc-800 pb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {description}
          </p>
        )}
        <p className="text-xs font-medium text-zinc-400">
          Последнее обновление: {updatedAt}
        </p>
      </header>

      <div className="space-y-8 text-sm md:text-[15px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {section.title}
            </h2>
            <div className="space-y-3">{section.content}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
