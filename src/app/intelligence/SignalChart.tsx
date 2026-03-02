"use client";

import { useMemo, useState } from "react";
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

const SIGNAL_COLORS: Record<string, string> = {
  GeopoliticsVolume: "#c4b5fd",
  RegulationVolume: "#cbd5e1",
  MarketsSentiment: "#a5b4fc",
  FinanceSentiment: "#6ee7b7",
  TechnologyVolume: "#7dd3fc",
  WarConflictVolume: "#fda4af",
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

  const signalNames = useMemo(() => Array.from(byName.keys()).sort(), [byName]);
  const [selected, setSelected] = useState(signalNames[0] ?? "");

  const chartData = useMemo(() => {
    if (!selected) return [];
    const list = byName.get(selected) ?? [];
    return list.map((p) => ({ date: p.date.slice(0, 10), zscore: Math.round(p.zscore * 100) / 100 }));
  }, [byName, selected]);

  if (signals.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label htmlFor="signal-select" className="text-body text-[#A1A1AA]">
          Signal
        </label>
        <select
          id="signal-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-badge border border-[#27272A] bg-[#18181B] px-3 py-2 text-body text-foreground focus:ring-2 focus:ring-ring"
        >
          {signalNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
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
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 8 }}
              labelStyle={{ color: "#A1A1AA" }}
              formatter={(value: number | undefined) => [value ?? 0, "z-score"]}
              labelFormatter={(label) => label}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="zscore"
              name={selected}
              stroke={SIGNAL_COLORS[selected] ?? "#60A5FA"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
