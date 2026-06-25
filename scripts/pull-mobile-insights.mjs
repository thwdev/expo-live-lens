import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const outputDir = resolve(process.argv[2] || join(rootDir, "tmp", "live-lens-review"));
const insightsPath = join(outputDir, "mobile-insights.json");

mkdirSync(outputDir, { recursive: true });

const response = await fetch(`${serverUrl}/api/mobile-insights`);
if (!response.ok) {
  throw new Error(`Failed to pull mobile insights: ${response.status} ${response.statusText}`);
}

const insights = await response.json();
writeFileSync(insightsPath, JSON.stringify(insights, null, 2));

console.log(`Mobile insights: ${insightsPath}`);
console.log(`Status: ${insights.status}`);
console.log(`Issues: ${insights.issues?.length || 0}`);
console.log(`Next action: ${insights.nextActions?.[0]?.label || "none"}`);
