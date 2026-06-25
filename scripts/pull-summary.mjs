import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const outputDir = resolve(process.argv[2] || join(rootDir, "tmp", "live-lens-review"));
const summaryPath = join(outputDir, "summary.json");

mkdirSync(outputDir, { recursive: true });

const response = await fetch(`${serverUrl}/api/summary`);
if (!response.ok) {
  throw new Error(`Failed to pull summary: ${response.status} ${response.statusText}`);
}

const summary = await response.json();
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(`Summary: ${summaryPath}`);
console.log(`Route: ${summary.route || "unknown"}`);
console.log(`Screen: ${summary.screenName || "unknown"}`);
console.log(`Events: ${summary.eventCount}`);
console.log(`Network failures: ${summary.network?.failed || 0}`);
console.log(`Latest error: ${summary.latestError ? summary.latestError.type : "none"}`);
