const serverUrl = (process.env.LIVE_LENS_SERVER_URL || "http://localhost:4317").replace(/\/$/, "");
const reason = process.argv[2] || "codex";

const response = await fetch(`${serverUrl}/api/capture-request`, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({ reason })
});

if (!response.ok) {
  throw new Error(`Failed to request capture: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
console.log(`Capture requested: ${payload.request?.id || "unknown"}`);
