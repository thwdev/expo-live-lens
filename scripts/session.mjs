import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const command = process.argv[2] || "list";
const outputDir = resolve(process.argv[4] || join(rootDir, "tmp", "live-lens-review"));

mkdirSync(outputDir, { recursive: true });

async function fetchJson(path, options) {
  const response = await fetch(`${serverUrl}${path}`, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `${path} failed: ${response.status} ${response.statusText}`);
  }

  return payload;
}

if (command === "start") {
  const name = process.argv[3] || `Mobile flow ${new Date().toLocaleTimeString()}`;
  const payload = await fetchJson("/api/sessions/start", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ name })
  });
  console.log(`Session started: ${payload.session.name}`);
  console.log(`Session id: ${payload.session.id}`);
} else if (command === "stop") {
  const payload = await fetchJson("/api/sessions/stop", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ reason: "codex" })
  });
  console.log(payload.session ? `Session stopped: ${payload.session.name}` : "No active session");
} else if (command === "pull") {
  const id = process.argv[3] || "latest";
  const packet = await fetchJson(`/api/sessions/${encodeURIComponent(id)}/packet`);
  const prompt = await fetchJson(`/api/sessions/${encodeURIComponent(id)}/review-prompt?mode=mobile`);
  const safeId = packet.session.id.replace(/[^a-z0-9-]/gi, "_");
  const packetPath = join(outputDir, `session-${safeId}.json`);
  const promptPath = join(outputDir, `session-${safeId}-prompt.md`);

  writeFileSync(packetPath, JSON.stringify(packet, null, 2));
  writeFileSync(promptPath, prompt.prompt);

  console.log(`Session packet: ${packetPath}`);
  console.log(`Session prompt: ${promptPath}`);
  console.log(`Events: ${packet.session.eventCount}`);
  console.log(`Screenshots: ${packet.session.screenshotCount}`);
} else {
  const payload = await fetchJson("/api/sessions");
  console.log(`Active session: ${payload.activeSession?.name || "none"}`);
  console.log(`Sessions: ${payload.sessions.length}`);
  for (const session of payload.sessions.slice(0, 5)) {
    console.log(`- ${session.name} (${session.status}) ${session.eventCount} events, ${session.screenshotCount} screenshots`);
  }
}
