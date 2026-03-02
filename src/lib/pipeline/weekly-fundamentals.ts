/**
 * Weekly fundamentals: EIA crude inventory, Baker Hughes rig count.
 * Fetches (when API keys set), persists to WeeklyFundamental, and provides
 * forward-filled daily values for the oil-signals pipeline.
 */
import { prisma } from "@/lib/db";

export const EIA_CRUDE_SERIES = "eia_crude_inventory_change";
export const BAKER_HUGHES_RIG_SERIES = "baker_hughes_rig_count";

/** Get weekly rows for a series, then forward-fill to daily for each date in dateStrings (asc). */
export async function getDailyForwardFilled(
  series: string,
  dateStrings: string[]
): Promise<Map<string, number>> {
  if (dateStrings.length === 0) return new Map();
  const minDate = dateStrings[0];
  const maxDate = dateStrings[dateStrings.length - 1];

  const rows = await prisma.weeklyFundamental.findMany({
    where: {
      series,
      reportDate: { gte: new Date(minDate + "Z"), lte: new Date(maxDate + "Z") },
    },
    orderBy: { reportDate: "asc" },
  });

  const weekToValue = new Map(rows.map((r) => [r.reportDate.toISOString().slice(0, 10), r.value]));
  const result = new Map<string, number>();
  let lastValue: number | null = null;
  for (const d of dateStrings) {
    const weekEnd = getWeekEnd(d);
    const v = weekToValue.get(weekEnd) ?? lastValue;
    if (v != null) lastValue = v;
    if (lastValue != null) result.set(d, lastValue);
  }
  return result;
}

/** Return the week-ending date (Friday) for the week containing the given YYYY-MM-DD. */
function getWeekEnd(dateStr: string): string {
  const d = new Date(dateStr + "Z");
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const daysToFriday = day <= 5 ? 5 - day : 5 - day + 7;
  d.setUTCDate(d.getUTCDate() + daysToFriday);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch EIA weekly US crude oil stocks change and persist.
 * EIA API v2: https://api.eia.gov/v2/petroleum/stoc/wstk/data/
 * Requires EIA_API_KEY. Series: WCRSTUS1 (US total crude stocks, weekly).
 */
export async function fetchAndPersistEIA(): Promise<{ rows: number; error?: string }> {
  const apiKey = process.env.EIA_API_KEY?.trim();
  if (!apiKey) return { rows: 0, error: "EIA_API_KEY not set" };

  try {
    // EIA v2: petroleum stocks, US total crude (WCRSTUS1), weekly
    const url = `https://api.eia.gov/v2/petroleum/stoc/wstk/data/?api_key=${encodeURIComponent(apiKey)}&frequency=weekly&data[0]=value&facets[series][]=WCRSTUS1&length=5000`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return { rows: 0, error: `EIA HTTP ${res.status}` };
    const data = (await res.json()) as {
      response?: { data?: { period: string; value: number }[] };
    };
    const items = data.response?.data ?? [];
    if (items.length === 0) return { rows: 0 };

    // Compute week-over-week change (inventory change) and store by week-ending date
    let rows = 0;
    const sorted = [...items].sort((a, b) => a.period.localeCompare(b.period));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].value;
      const curr = sorted[i].value;
      const change = curr - prev;
      const reportDate = new Date(sorted[i].period + "Z");
      await prisma.weeklyFundamental.upsert({
        where: {
          series_reportDate: { series: EIA_CRUDE_SERIES, reportDate },
        },
        create: {
          series: EIA_CRUDE_SERIES,
          reportDate,
          value: change,
        },
        update: { value: change },
      });
      rows++;
    }
    return { rows };
  } catch (e) {
    return { rows: 0, error: e instanceof Error ? e.message : "EIA fetch failed" };
  }
}

/**
 * Fetch Baker Hughes North American rig count and persist.
 * Optional: set OILPRICE_API_KEY for oilpriceapi.com (free tier includes rig count).
 * Or backfill manually via script / Supabase.
 */
export async function fetchAndPersistRigCount(): Promise<{ rows: number; error?: string }> {
  const apiKey = process.env.OILPRICE_API_KEY?.trim();
  if (!apiKey) return { rows: 0, error: "OILPRICE_API_KEY not set (optional for rig count)" };

  try {
    // OilPriceAPI: Baker Hughes rig count (US total or North America)
    const res = await fetch(
      `https://api.oilpriceapi.com/v1/rigcount?api_key=${encodeURIComponent(apiKey)}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return { rows: 0, error: `Rig API HTTP ${res.status}` };
    const data = (await res.json()) as { data?: { date: string; value: number }[]; status?: string };
    const items = Array.isArray(data.data) ? data.data : [];
    let rows = 0;
    for (const item of items) {
      const reportDate = new Date(item.date + "Z");
      await prisma.weeklyFundamental.upsert({
        where: {
          series_reportDate: { series: BAKER_HUGHES_RIG_SERIES, reportDate },
        },
        create: {
          series: BAKER_HUGHES_RIG_SERIES,
          reportDate,
          value: item.value,
        },
        update: { value: item.value },
      });
      rows++;
    }
    return { rows };
  } catch (e) {
    return { rows: 0, error: e instanceof Error ? e.message : "Rig fetch failed" };
  }
}

export async function fetchAndPersistAll(): Promise<{
  eia: { rows: number; error?: string };
  rig: { rows: number; error?: string };
}> {
  const [eia, rig] = await Promise.all([fetchAndPersistEIA(), fetchAndPersistRigCount()]);
  return { eia, rig };
}
