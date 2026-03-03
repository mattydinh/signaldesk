/**
 * Tests that market prices can be fetched from Yahoo Finance (v3 API) and that
 * runMarketPrices ingests data when a DB is available.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { runMarketPrices } from "./market-prices";

describe("market-prices", () => {
  it("fetches historical prices from Yahoo Finance (v3 API) and returns data", async () => {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance({ suppressNotices: ["ripHistorical"] });

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 5);
    const period1 = start.toISOString().slice(0, 10);
    const period2 = end.toISOString().slice(0, 10);

    const result = await yahooFinance.historical("SPY", { period1, period2 });

    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBeGreaterThan(0);

    const first = (result as { date: Date; open: number; high: number; low: number; close: number; volume: number }[])[0];
    expect(first).toBeDefined();
    expect(first.date).toBeInstanceOf(Date);
    expect(typeof first.open).toBe("number");
    expect(typeof first.high).toBe("number");
    expect(typeof first.low).toBe("number");
    expect(typeof first.close).toBe("number");
    expect(typeof first.volume).toBe("number");
    expect(first.close).toBeGreaterThan(0);
  }, 15_000);

  it("runMarketPrices ingests data and rowsWritten increases", async () => {
    const hasDb =
      typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0 ||
      (typeof process.env.POSTGRES_PRISMA_URL === "string" && process.env.POSTGRES_PRISMA_URL.length > 0);
    if (!hasDb) {
      return; // skip when no DB (e.g. CI without secrets)
    }

    const result = await runMarketPrices(14);

    expect(result).toHaveProperty("rowsWritten");
    expect(typeof result.rowsWritten).toBe("number");
    expect(result.rowsWritten).toBeGreaterThan(0);
  }, 60_000);
});
