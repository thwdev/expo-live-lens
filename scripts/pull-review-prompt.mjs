import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const mode = process.argv[2] || "quick";
const outputDir = resolve(process.argv[3] || join(rootDir, "tmp", "live-lens-review"));
const promptPath = join(outputDir, `review-prompt-${mode}.md`);
const payloadPath = join(outputDir, `review-prompt-${mode}.json`);

mkdirSync(outputDir, { recursive: true });

const response = await fetch(`${serverUrl}/api/review-prompt?mode=${encodeURIComponent(mode)}`);
if (!response.ok) {
  throw new Error(`Failed to pull review prompt: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
writeFileSync(promptPath, payload.prompt);
writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

console.log(`Review prompt (${payload.label}): ${promptPath}`);
console.log(`Prompt payload: ${payloadPath}`);
console.log(`Latest screen: ${payload.summary?.screenName || "unknown"}`);
console.log(`Latest route: ${payload.summary?.route || "unknown"}`);
