"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getCategoryTagStyle } from "@/lib/categories";
import ArticleDrawer from "./ArticleDrawer";
import type { Article } from "./types";

export default function ArticleFeed({ articles }: { articles: Article[] }) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  return (
    <>
      <ul className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Intelligence feed articles">
        {articles.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setSelectedArticle(a)}
              className="glass-card card-hover accent-bar rounded-card border border-[#27272A] p-6 w-full text-left cursor-pointer transition-colors hover:border-[#3F3F46]"
              aria-label={`View details: ${a.title}`}
            >
              <span className="text-meta text-[#71717A] flex items-center gap-2">
                <span>
                  {a.source.name}
                  {a.publishedAt && ` · ${new Date(a.publishedAt).toLocaleDateString()}`}
                </span>
                {!!a.implications && (
                  <span className="inline-flex items-center gap-1 rounded-badge bg-[#22C55E]/10 px-2 py-0.5 text-[#22C55E]">
                    <Sparkles size={12} />
                    <span className="text-[11px] font-medium">Analyzed</span>
                  </span>
                )}
              </span>
              <h2 className="mt-2 text-card-title text-foreground">{a.title}</h2>
              {a.summary && (
                <p className="mt-2 text-body text-[#A1A1AA] line-clamp-2 leading-relaxed">{a.summary}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Article tags">
                {a.categories?.slice(0, 3).map((c) => {
                  const tagStyle = getCategoryTagStyle(c);
                  return (
                    <span
                      key={c}
                      className="rounded-badge border px-3 py-1 text-meta font-medium"
                      style={{ backgroundColor: tagStyle.backgroundColor, color: tagStyle.color, borderColor: tagStyle.borderColor }}
                    >
                      {c}
                    </span>
                  );
                })}
                {a.entities?.slice(0, 4).map((e) => (
                  <span key={e} className="rounded-badge bg-[#18181B]/80 px-3 py-1 text-meta text-[#A1A1AA]">{e}</span>
                ))}
              </div>
              {a.implications && (
                <p className="mt-3 text-body text-[#A1A1AA] line-clamp-1 leading-relaxed">{a.implications}</p>
              )}
            </button>
          </li>
        ))}
      </ul>

      <ArticleDrawer article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </>
  );
}
