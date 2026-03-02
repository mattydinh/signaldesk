/**
 * Pipeline step 4: fetch market prices from Yahoo Finance and store in market_prices.
 */
import { prisma } from "@/lib/db";

const TICKERS = ["SPY", "QQQ", "XLK", "XLF", "VNQ", "GLD", "USO"] as const;

type HistoricalRow = { date: Date; open: number; high: number; low: number; close: number; volume: number };

async function fetchHistorical(
  symbol: string,
  period1: string,
  period2: string
): Promise<HistoricalRow[]> {
  const yf = (await import("yahoo-finance2")).default as { historical: (s: string, o: { period1: string; period2: string }) => Promise<unknown> };
  const result = await yf.historical(symbol, { period1, period2 });
  return (Array.isArray(result) ? result : []) as HistoricalRow[];
}

export async function runMarketPrices(daysBack = 365): Promise<{ rowsWritten: number }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const period1 = start.toISOString().slice(0, 10);
  const period2 = end.toISOString().slice(0, 10);

  let rowsWritten = 0;
  for (const ticker of TICKERS) {
    try {
      const rows = await fetchHistorical(ticker, period1, period2);
      rows.sort((a, b) => a.date.getTime() - b.date.getTime());
      let prevClose = 0;
      for (const r of rows) {
        const date = new Date(r.date);
        date.setUTCHours(0, 0, 0, 0);
        const dailyReturn = prevClose > 0 ? (r.close / prevClose - 1) : 0;
        prevClose = r.close;
        await prisma.marketPrice.upsert({
          where: { ticker_date: { ticker, date } },
          create: {
            ticker,
            date,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            volume: BigInt(r.volume),
            dailyReturn,
          },
          update: {
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            volume: BigInt(r.volume),
            dailyReturn,
          },
        });
        rowsWritten++;
      }
    } catch (e) {
      console.error("[pipeline/market-prices] fetch failed for", ticker, e);
    }
  }
  return { rowsWritten };
}
