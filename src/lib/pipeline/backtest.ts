/**
 * Pipeline step 6: run backtest for a signal + ticker and persist to backtest_results.
 */
import { prisma } from "@/lib/db";

const DEFAULT_DAYS = 90;
const COST_BPS = 10;

export async function runBacktest(
  signalName: string,
  ticker: string,
  options?: { startDate?: Date; endDate?: Date; transactionCostBps?: number }
): Promise<void> {
  const end = options?.endDate ?? new Date();
  const start = options?.startDate ?? new Date(end.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);
  const costBps = (options?.transactionCostBps ?? COST_BPS) / 10000;

  const signals = await prisma.derivedSignal.findMany({
    where: { signalName, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  const prices = await prisma.marketPrice.findMany({
    where: { ticker, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  const priceByDate = new Map(prices.map((p) => [p.date.toISOString().slice(0, 10), p]));
  const signalByDate = new Map(signals.map((s) => [s.date.toISOString().slice(0, 10), s]));

  let position = 0;
  let prevPosition = 0;
  let cumReturn = 1;
  let hits = 0;
  let total = 0;
  let turnoverSum = 0;
  const returns: number[] = [];

  const dateStrs = Array.from(
    new Set([
      ...signals.map((s) => s.date.toISOString().slice(0, 10)),
      ...prices.map((p) => p.date.toISOString().slice(0, 10)),
    ])
  ).sort();

  for (const dateStr of dateStrs) {
    const sig = signalByDate.get(dateStr);
    const pr = priceByDate.get(dateStr);
    if (!pr) continue;

    prevPosition = position;
    if (sig) {
      position = sig.zscore > 1 ? 1 : sig.zscore < -1 ? -1 : 0;
    }

    const ret = prevPosition * pr.dailyReturn;
    const cost = Math.abs(position - prevPosition) * costBps;
    const netRet = ret - cost;
    cumReturn *= 1 + netRet;
    returns.push(netRet);
    if (prevPosition !== 0) {
      total++;
      if ((prevPosition > 0 && pr.dailyReturn > 0) || (prevPosition < 0 && pr.dailyReturn < 0))
        hits++;
    }
    turnoverSum += Math.abs(position - prevPosition);
  }

  const n = returns.length;
  const avgRet = n > 0 ? returns.reduce((a, b) => a + b, 0) / n : 0;
  const variance =
    n > 1 ? returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (n - 1) : 0;
  const vol = Math.sqrt(variance) || 1e-8;
  const sharpe = (avgRet / vol) * Math.sqrt(252);
  let peak = 1;
  let maxDrawdown = 0;
  let running = 1;
  for (const r of returns) {
    running *= 1 + r;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, (peak - running) / peak);
  }
  const annualizedReturn = (Math.pow(cumReturn, 252 / n) - 1) || 0;
  const annualizedVol = vol * Math.sqrt(252);
  const hitRate = total > 0 ? hits / total : 0;
  const turnover = n > 0 ? turnoverSum / n : 0;

  await prisma.backtestResult.upsert({
    where: {
      signalName_ticker_startDate_endDate: {
        signalName,
        ticker,
        startDate: start,
        endDate: end,
      },
    },
    create: {
      signalName,
      ticker,
      startDate: start,
      endDate: end,
      cumulativeReturn: cumReturn - 1,
      annualizedReturn,
      annualizedVolatility: annualizedVol,
      sharpe,
      maxDrawdown,
      turnover,
      hitRate,
    },
    update: {
      cumulativeReturn: cumReturn - 1,
      annualizedReturn,
      annualizedVolatility: annualizedVol,
      sharpe,
      maxDrawdown,
      turnover,
      hitRate,
    },
  });
}
