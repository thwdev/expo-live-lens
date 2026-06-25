import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const outputDir = resolve(process.argv[2] || join(rootDir, "tmp", "live-lens-review"));
const timelinePath = join(outputDir, "timeline.json");

mkdirSync(outputDir, { recursive: true });

const response = await fetch(`${serverUrl}/api/timeline?limit=40`);
if (!response.ok) {
  throw new Error(`Failed to pull timeline: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
writeFileSync(timelinePath, JSON.stringify(payload, null, 2));

console.log(`Timeline: ${timelinePath}`);
console.log(`Events: ${payload.timeline?.length || 0}`);
console.log(`Latest: ${payload.timeline?.[0]?.type || "none"}`);
