"use client";

import { useState } from "react";
import SignalChart from "./SignalChart";

export type SectorCompositeData = {
  latestZ: number | null;
  components: Record<string, number | undefined>;
  componentSignals: readonly string[];
  series: { date: string; signalName: string; zscore: number }[];
  backtests: Array<{
    ticker: string;
    sharpe: number;
    maxDrawdown: number;
    annualizedReturn: number | null;
    hitRate: number | null;
    endDate: Date | string | null;
  }>;
};

type SectorConfig = {
  id: string;
  label: string;
  compositeName: string;
};

type Props = {
  sectors: SectorConfig[];
  dataBySector: Record<string, SectorCompositeData>;
};

export default function SectorCompositesView({ sectors, dataBySector }: Props) {
  const [selectedId, setSelectedId] = useState(sectors[0]?.id ?? "");
  const data = selectedId ? dataBySector[selectedId] : null;
  const sector = sectors.find((s) => s.id === selectedId);

  const hasAnyData = sectors.some((s) => dataBySector[s.id]?.latestZ != null);

  if (sectors.length === 0) return null;

  return (
    <div className="space-y-6 pt-6 border-t border-[#27272A]">
      <div>
        <h3 className="text-section-header text-foreground mb-2">Sector composites</h3>
        <p className="text-meta text-[#71717A] mb-4">
          Composite z-scores from price momentum, sector sentiment, and volume. Select a sector to see gauge, components, chart, and backtest.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label htmlFor="sector-composite-select" className="text-body text-[#A1A1AA]">
            Sector
          </label>
          <select
            id="sector-composite-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-badge border border-[#27272A] bg-[#18181B] px-3 py-2 text-body text-foreground focus:ring-2 focus:ring-ring"
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!data && !hasAnyData ? (
        <p className="text-body text-[#71717A]">
          No sector composite data yet. Run the pipeline (part 1 + part 2) to compute.
        </p>
      ) : data && sector ? (
        <>
          {data.latestZ != null ? (
            <>
              <div>
                <p className="text-meta text-[#71717A] mb-2">Composite z-score (latest)</p>
                <div className="h-3 w-full max-w-md rounded-pill bg-[#27272A] overflow-hidden flex">
                  <div
                    className="h-full rounded-pill transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((data.latestZ + 3) / 6) * 100))}%`,
                      backgroundColor:
                        data.latestZ >= 1 ? "#34D399" : data.latestZ <= -1 ? "#F87171" : "#71717A",
                    }}
                  />
                </div>
                <p className="text-body text-foreground mt-1">
                  {data.latestZ <= -2
                    ? "Strong Bearish"
                    : data.latestZ <= -1
                      ? "Bearish"
                      : data.latestZ < 1
                        ? "Neutral"
                        : data.latestZ < 2
                          ? "Bullish"
                          : "Strong Bullish"}{" "}
                  ({data.latestZ.toFixed(2)})
                </p>
              </div>
              <div className="overflow-x-auto rounded-card border border-[#27272A]">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-[#27272A] bg-[#18181B]/40">
                      <th className="px-4 py-3 text-left font-medium text-foreground">Component</th>
                      <th className="px-4 py-3 text-right font-medium text-foreground">z-score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.componentSignals.map((name) => (
                      <tr key={name} className="border-b border-[#27272A]/60">
                        <td className="px-4 py-3 text-foreground">{name}</td>
                        <td className="px-4 py-3 text-right text-[#A1A1AA]">
                          {data.components[name] != null && Number.isFinite(data.components[name])
                          ? Number(data.components[name]).toFixed(2)
                          : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.series.length > 0 && (
                <div>
                  <p className="text-meta text-[#71717A] mb-2">{sector.label} composite z over time</p>
                  <SignalChart signals={data.series} />
                </div>
              )}
              {data.backtests.length > 0 && (
                <div>
                  <p className="text-meta text-[#71717A] mb-2">Backtest: {sector.compositeName} vs tickers</p>
                  <ul className="space-y-2 text-body text-[#A1A1AA]">
                    {data.backtests.map((r) => {
                      const sharpe = Number(r.sharpe);
                      const maxDd = Number(r.maxDrawdown);
                      const annRet = Number(r.annualizedReturn ?? 0);
                      const hitRate = Number(r.hitRate ?? 0);
                      const endStr = r.endDate ? String(r.endDate).slice(0, 10) : r.ticker;
                      return (
                        <li key={`${r.ticker}-${endStr}`}>
                          {r.ticker}: Sharpe {Number.isFinite(sharpe) ? sharpe.toFixed(2) : "—"}, Max DD{" "}
                          {Number.isFinite(maxDd) ? (maxDd * 100).toFixed(1) : "—"}%, Ann return{" "}
                          {Number.isFinite(annRet) ? (annRet * 100).toFixed(1) : "—"}%, Hit rate{" "}
                          {Number.isFinite(hitRate) ? (hitRate * 100).toFixed(0) : "—"}%
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-body text-[#71717A]">
              No data for {sector.label} yet. Run the pipeline to compute.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
