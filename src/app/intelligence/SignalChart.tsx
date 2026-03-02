"use client";

import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type SignalPoint = { date: string; signalName: string; zscore: number };

const SENTIMENT_SIGNALS = ["MarketsSentiment", "FinanceSentiment", "EnergySentiment", "HealthcareSentiment"];
const VOLUME_SIGNALS = ["GeopoliticsVolume", "RegulationVolume", "WarConflictVolume", "TechnologyVolume", "OilNewsVolume"];

const SIGNAL_COLORS: Record<string, string> = {
  GeopoliticsVolume: "#c4b5fd",
  RegulationVolume: "#cbd5e1",
  MarketsSentiment: "#a5b4fc",
  FinanceSentiment: "#6ee7b7",
  TechnologyVolume: "#7dd3fc",
  WarConflictVolume: "#fda4af",
  OilCompositeSignal: "#fdba74",
  OilPriceMomentum: "#fdba74",
  EnergySentiment: "#5eead4",
  OilNewsVolume: "#fbbf24",
  HealthcareSentiment: "#5eead4",
};

export default function SignalChart({ signals }: { signals: SignalPoint[] }) {
  const byName = useMemo(() => {
    const m = new Map<string, SignalPoint[]>();
    for (const s of signals) {
      const list = m.get(s.signalName) ?? [];
      list.push(s);
      m.set(s.signalName, list);
    }
    Array.from(m.values()).forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
    return m;
  }, [signals]);

  const sentimentOptions = useMemo(
    () => SENTIMENT_SIGNALS.filter((name) => byName.has(name)),
    [byName]
  );
  const volumeOptions = useMemo(
    () => VOLUME_SIGNALS.filter((name) => byName.has(name)),
    [byName]
  );

  const [sentimentSelected, setSentimentSelected] = useState(sentimentOptions[0] ?? "");
  const [volumeSelected, setVolumeSelected] = useState(volumeOptions[0] ?? "");
  const [chartSource, setChartSource] = useState<"sentiment" | "volume">(
    sentimentOptions.length > 0 ? "sentiment" : "volume"
  );

  useEffect(() => {
    if (sentimentOptions.length && !sentimentOptions.includes(sentimentSelected)) setSentimentSelected(sentimentOptions[0]);
    if (volumeOptions.length && !volumeOptions.includes(volumeSelected)) setVolumeSelected(volumeOptions[0]);
  }, [sentimentOptions, volumeOptions, sentimentSelected, volumeSelected]);

  const chartSignal = useMemo(() => {
    const fromSentiment = chartSource === "sentiment" && sentimentSelected && byName.has(sentimentSelected);
    const fromVolume = chartSource === "volume" && volumeSelected && byName.has(volumeSelected);
    if (fromSentiment) return sentimentSelected;
    if (fromVolume) return volumeSelected;
    if (sentimentSelected && byName.has(sentimentSelected)) return sentimentSelected;
    if (volumeSelected && byName.has(volumeSelected)) return volumeSelected;
    return "";
  }, [chartSource, sentimentSelected, volumeSelected, byName]);

  const chartData = useMemo(() => {
    if (!chartSignal) return [];
    const list = byName.get(chartSignal) ?? [];
    return list.map((p) => ({ date: p.date.slice(0, 10), zscore: Math.round(p.zscore * 100) / 100 }));
  }, [byName, chartSignal]);

  if (signals.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="sentiment-select" className="text-body text-[#A1A1AA]">
            Sentiment
          </label>
          <select
            id="sentiment-select"
            value={sentimentSelected}
            onChange={(e) => {
              setSentimentSelected(e.target.value);
              setChartSource("sentiment");
            }}
            className="rounded-badge border border-[#27272A] bg-[#18181B] px-3 py-2 text-body text-foreground focus:ring-2 focus:ring-ring"
          >
            {sentimentOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="volume-select" className="text-body text-[#A1A1AA]">
            Volume
          </label>
          <select
            id="volume-select"
            value={volumeSelected}
            onChange={(e) => {
              setVolumeSelected(e.target.value);
              setChartSource("volume");
            }}
            className="rounded-badge border border-[#27272A] bg-[#18181B] px-3 py-2 text-body text-foreground focus:ring-2 focus:ring-ring"
          >
            {volumeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-meta text-[#71717A]">
          Chart shows: <strong className="text-foreground">{chartSignal || "—"}</strong>
        </span>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717A", fontSize: 11 }}
              stroke="#27272A"
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              tick={{ fill: "#71717A", fontSize: 11 }}
              stroke="#27272A"
              domain={["auto", "auto"]}
              tickFormatter={(v) => String(v)}
              label={{ value: "z-score", angle: -90, position: "insideLeft", style: { fill: "#71717A", fontSize: 11 } }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 8 }}
              labelStyle={{ color: "#A1A1AA" }}
              formatter={(value: number | undefined) => {
                const z = value ?? 0;
                const interpretation =
                  z > 1 ? "Unusually high vs 60-day average" : z < -1 ? "Unusually low vs 60-day average" : "Within normal range";
                return [`${z} (${interpretation})`, "z-score"];
              }}
              labelFormatter={(label) => label}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="zscore"
              name={chartSignal}
              stroke={SIGNAL_COLORS[chartSignal] ?? "#60A5FA"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
