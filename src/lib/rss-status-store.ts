/**
 * In-memory store for RSS ingest status. Updated on each fetch+ingest.
 * Used by /api/debug/rss-status. Resets on cold start.
 */
export type RssStatus = {
  lastFetchTimestamp: string;
  articlesFetchedCount: number;
  articlesInsertedCount: number;
  articlesSkippedCount: number;
  lastError: string | null;
  pipelineStage: "fetch" | "dedup" | "insert" | "done" | "error";
};

let lastStatus: RssStatus | null = null;

export function setRssStatus(status: Partial<RssStatus>) {
  lastStatus = {
    lastFetchTimestamp: status.lastFetchTimestamp ?? new Date().toISOString(),
    articlesFetchedCount: status.articlesFetchedCount ?? lastStatus?.articlesFetchedCount ?? 0,
    articlesInsertedCount: status.articlesInsertedCount ?? lastStatus?.articlesInsertedCount ?? 0,
    articlesSkippedCount: status.articlesSkippedCount ?? lastStatus?.articlesSkippedCount ?? 0,
    lastError: status.lastError ?? lastStatus?.lastError ?? null,
    pipelineStage: status.pipelineStage ?? lastStatus?.pipelineStage ?? "done",
  };
}

export function getRssStatus(): RssStatus | null {
  return lastStatus ? { ...lastStatus } : null;
}
