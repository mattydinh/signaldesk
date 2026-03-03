/**
 * Run the ML pipeline locally (loads .env from project root).
 * Usage: npx tsx scripts/run-pipeline-local.ts
 * Or with env: node --env-file=.env node_modules/.bin/tsx scripts/run-pipeline-local.ts
 */
import "dotenv/config";
import { runPipelinePart1, runPipelinePart2 } from "@/lib/pipeline/run";

async function main() {
  console.log("Running pipeline Part 1 (events → features → topic metrics → derived signals → oil/pharma)...");
  const p1 = await runPipelinePart1();
  console.log("Part 1 result:", JSON.stringify(p1, null, 2));
  console.log("\nRunning pipeline Part 2 (market prices → regime → backtest)...");
  const p2 = await runPipelinePart2();
  console.log("Part 2 result:", JSON.stringify(p2, null, 2));
  console.log("\nPipeline complete. Refresh /intelligence to see the data.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
