"use client";

import { useEffect, useCallback } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Article } from "./types";

function AnalysisSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-meta uppercase tracking-wide text-[#71717A]">{label}</h4>
      <p className="text-body text-foreground">{children}</p>
    </div>
  );
}

function useDrawerEffects(isOpen: boolean, onClose: () => void) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);
}

export default function ArticleDrawer({
  article,
  onClose,
}: {
  article: Article | null;
  onClose: () => void;
}) {
  useDrawerEffects(!!article, onClose);

  if (!article) return null;

  const isAnalyzed =
    !!article.implications ||
    article.opportunities?.length > 0 ||
    !!article.forShareholders ||
    !!article.forInvestors ||
    !!article.forBusiness;

  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg animate-in slide-in-from-right duration-300 overflow-y-auto bg-[#09090B] border-l border-[#27272A] shadow-2xl" role="dialog" aria-modal="false" aria-label={article.title}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#27272A] bg-[#09090B]/95 backdrop-blur px-6 py-4">
          <span className="text-meta text-[#71717A]">
            {article.source.name}
            {article.publishedAt && ` · ${new Date(article.publishedAt).toLocaleDateString()}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-badge p-2 text-[#A1A1AA] hover:text-foreground hover:bg-[#18181B] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          <h2 className="text-card-title text-foreground leading-tight">{article.title}</h2>

          {article.summary && (
            <p className="text-body text-[#A1A1AA] leading-relaxed">{article.summary}</p>
          )}

          {(article.entities?.length > 0 || article.topics?.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {article.entities?.map((e) => (
                <span key={e} className="rounded-badge bg-[#18181B]/80 px-3 py-1 text-meta text-[#A1A1AA]">{e}</span>
              ))}
              {article.topics?.map((t) => (
                <span key={t} className="rounded-badge signal-neutral px-3 py-1 text-meta font-medium">{t}</span>
              ))}
            </div>
          )}

          <div className="border-t border-[#27272A] pt-6">
            {isAnalyzed ? (
              <div className="space-y-5">
                <h3 className="text-body font-semibold text-foreground">AI Analysis</h3>
                {article.implications && (
                  <p className="text-body font-medium leading-relaxed signal-positive">{article.implications}</p>
                )}
                {article.opportunities?.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-meta uppercase tracking-wide text-[#71717A]">Opportunities</h4>
                    <ul className="list-inside list-disc space-y-1 text-body text-foreground">
                      {article.opportunities.map((opp) => (
                        <li key={opp}>{opp}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {article.forShareholders && <AnalysisSection label="For shareholders">{article.forShareholders}</AnalysisSection>}
                {article.forInvestors && <AnalysisSection label="For investors">{article.forInvestors}</AnalysisSection>}
                {article.forBusiness && <AnalysisSection label="For business">{article.forBusiness}</AnalysisSection>}
              </div>
            ) : (
              <p className="text-body text-[#71717A]">
                Analysis pending — this article will be analyzed in the next cron cycle.
              </p>
            )}
          </div>

          {article.url && (
            <div className="border-t border-[#27272A] pt-6">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-badge bg-primary px-5 py-2.5 text-body font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
              >
                Open article
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>
    </div>
  );
}
