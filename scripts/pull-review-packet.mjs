import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const outputDir = resolve(positionalArgs[0] || join(rootDir, "tmp", "live-lens-review"));
const packetPath = join(outputDir, "review-packet.json");
const screenshotPath = join(outputDir, "latest-screenshot.jpg");
const mode = process.argv.includes("--now") ? "now" : "pull";
const timeoutMs = Number(process.env.LIVE_LENS_REVIEW_TIMEOUT_MS || 10000);
const pollMs = Number(process.env.LIVE_LENS_REVIEW_POLL_MS || 500);

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

mkdirSync(outputDir, { recursive: true });

async function fetchJson(path, options) {
  const response = await fetch(`${serverUrl}${path}`, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${path} ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchLatestScreenshot() {
  const response = await fetch(`${serverUrl}/api/latest-screenshot.jpg`);
  if (!response.ok) {
    return false;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(screenshotPath, buffer);
  return true;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

let captureRequestedAt = null;
if (mode === "now") {
  const capture = await fetchJson("/api/capture-request", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ reason: "review-now" })
  });
  captureRequestedAt = capture.request?.requestedAt || null;
  console.log(`Capture requested: ${capture.request?.id || "unknown"}`);
}

let packet = null;
const startedAt = Date.now();
let timedOut = false;

while (Date.now() - startedAt <= timeoutMs) {
  packet = await fetchJson("/api/review-packet");

  const screenshotTime = packet.latestScreenshot?.receivedAt
    ? new Date(packet.latestScreenshot.receivedAt).getTime()
    : 0;
  const requestTime = captureRequestedAt ? new Date(captureRequestedAt).getTime() : 0;

  if (mode === "pull" || screenshotTime >= requestTime) {
    break;
  }

  await sleep(pollMs);
}

if (mode === "now" && captureRequestedAt && !packet.latestScreenshot) {
  timedOut = true;
}

const inlineImage = parseDataUrl(packet.latestScreenshot?.image);
if (inlineImage) {
  writeFileSync(screenshotPath, inlineImage.buffer);
} else if (packet.latestScreenshot?.imageUrl) {
  await fetchLatestScreenshot();
}

const packetWithoutInlineImage = {
  ...packet,
  latestScreenshot: packet.latestScreenshot
    ? {
        ...packet.latestScreenshot,
        image: undefined,
        imageUrl: packet.latestScreenshot.imageUrl || "/api/latest-screenshot.jpg",
        localImagePath: screenshotPath
      }
    : null
};

writeFileSync(packetPath, JSON.stringify(packetWithoutInlineImage, null, 2));

console.log(`Review packet: ${packetPath}`);
if (packet.latestScreenshot) {
  console.log(`Screenshot: ${screenshotPath}`);
} else {
  console.log(timedOut ? "Screenshot: none received before timeout" : "Screenshot: none available yet");
}
console.log(`Recent events: ${packet.recentEvents?.length || 0}`);
