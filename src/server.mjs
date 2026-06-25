import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = normalize(join(__dirname, ".."));
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT || 4317);
const maxEvents = Number(process.env.LENS_MAX_EVENTS || 200);
const maxScreenshotImages = Number(process.env.LENS_MAX_SCREENSHOT_IMAGES || 3);

const events = [];
const clients = new Set();
let latestCaptureRequest = null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function addEvent(input) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    receivedAt: new Date().toISOString(),
    ...input
  };

  events.unshift(event);
  pruneEvents();

  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(line);
  }

  return event;
}

function pruneEvents() {
  let screenshotImages = 0;

  for (const event of events) {
    if (event.type === "screenshot" && event.image) {
      screenshotImages += 1;

      if (screenshotImages > maxScreenshotImages) {
        event.image = undefined;
        event.payload = {
          ...event.payload,
          imagePruned: true
        };
      }
    }
  }

  events.splice(maxEvents);
}

function clearEvents() {
  events.splice(0, events.length);
  const event = {
    id: `${Date.now()}-cleared`,
    receivedAt: new Date().toISOString(),
    type: "cleared",
    payload: {
      reason: "manual"
    }
  };

  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(line);
  }
}

function getLatestScreenshot() {
  return events.find((event) => event.type === "screenshot" && event.image);
}

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

function getReviewPacket() {
  const latestScreenshot = getLatestScreenshot();
  const recentEvents = events
    .filter((event) => event.type !== "screenshot")
    .slice(0, 50)
    .map((event) => ({
      ...event,
      image: undefined
    }));

  return {
    createdAt: new Date().toISOString(),
    summary: getSummary(),
    latestScreenshot: latestScreenshot
      ? {
          id: latestScreenshot.id,
          receivedAt: latestScreenshot.receivedAt,
          screenName: latestScreenshot.screenName,
          device: latestScreenshot.device,
          payload: latestScreenshot.payload,
          imageUrl: "/api/latest-screenshot.jpg"
        }
      : null,
    recentEvents
  };
}

function getSummary() {
  const nonScreenshotEvents = events.filter((event) => event.type !== "screenshot");
  const latestScreenshot = getLatestScreenshot();
  const latestError = nonScreenshotEvents.find((event) => event.type === "error" || event.level === "error") || null;
  const latestRouteEvent = nonScreenshotEvents.find((event) => event.payload?.route || event.payload?.screenName) || null;
  const networkEvents = nonScreenshotEvents.filter((event) => event.type === "network" || event.type === "network-error");
  const failedNetworkEvents = networkEvents.filter(
    (event) => event.type === "network-error" || event.payload?.ok === false || Number(event.payload?.status || 0) >= 400
  );

  return {
    createdAt: new Date().toISOString(),
    eventCount: events.length,
    screenshotCount: events.filter((event) => event.type === "screenshot").length,
    retainedScreenshotImages: events.filter((event) => event.type === "screenshot" && event.image).length,
    latestScreenshot: latestScreenshot
      ? {
          id: latestScreenshot.id,
          receivedAt: latestScreenshot.receivedAt,
          screenName: latestScreenshot.screenName,
          device: latestScreenshot.device,
          imageUrl: "/api/latest-screenshot.jpg"
        }
      : null,
    latestError: latestError
      ? {
          id: latestError.id,
          receivedAt: latestError.receivedAt,
          type: latestError.type,
          level: latestError.level,
          screenName: latestError.screenName,
          payload: latestError.payload
        }
      : null,
    route: latestRouteEvent?.payload?.route || latestRouteEvent?.screenName || null,
    screenName: latestRouteEvent?.screenName || latestScreenshot?.screenName || null,
    appState: nonScreenshotEvents.find((event) => event.type === "app-state")?.payload?.state || null,
    network: {
      total: networkEvents.length,
      failed: failedNetworkEvents.length,
      latestFailure: failedNetworkEvents[0]
        ? {
            id: failedNetworkEvents[0].id,
            receivedAt: failedNetworkEvents[0].receivedAt,
            payload: failedNetworkEvents[0].payload
          }
        : null
    },
    recentEventTypes: nonScreenshotEvents.slice(0, 12).map((event) => ({
      type: event.type,
      level: event.level || null,
      receivedAt: event.receivedAt,
      screenName: event.screenName || null
    }))
  };
}

function createCaptureRequest(reason = "manual") {
  latestCaptureRequest = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    requestedAt: new Date().toISOString(),
    reason
  };

  addEvent({
    type: "capture-request",
    payload: latestCaptureRequest
  });

  return latestCaptureRequest;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        events: events.length,
        maxEvents,
        maxScreenshotImages,
        screenshotImages: events.filter((event) => event.type === "screenshot" && event.image).length,
        latestCaptureRequest,
        clients: clients.size,
        now: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === "/api/events" && request.method === "GET") {
      sendJson(response, 200, { events });
      return;
    }

    if (url.pathname === "/api/events" && request.method === "DELETE") {
      clearEvents();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/review-packet" && request.method === "GET") {
      sendJson(response, 200, getReviewPacket());
      return;
    }

    if (url.pathname === "/api/summary" && request.method === "GET") {
      sendJson(response, 200, getSummary());
      return;
    }

    if (url.pathname === "/api/latest-screenshot.jpg" && request.method === "GET") {
      const latestScreenshot = getLatestScreenshot();
      const image = parseDataUrl(latestScreenshot?.image);

      if (!image) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("No screenshot available");
        return;
      }

      response.writeHead(200, {
        "Content-Type": image.mimeType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      response.end(image.buffer);
      return;
    }

    if (url.pathname === "/api/capture-request" && request.method === "POST") {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      sendJson(response, 200, {
        ok: true,
        request: createCaptureRequest(payload.reason || "manual")
      });
      return;
    }

    if (url.pathname === "/api/capture-request" && request.method === "GET") {
      const since = url.searchParams.get("since");
      sendJson(response, 200, {
        request: latestCaptureRequest && latestCaptureRequest.id !== since ? latestCaptureRequest : null
      });
      return;
    }

    if (url.pathname === "/api/events" && request.method === "POST") {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const event = addEvent(payload);
      sendJson(response, 200, { ok: true, event });
      return;
    }

    if (url.pathname === "/api/events/stream") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      response.write(`data: ${JSON.stringify({ type: "connected", receivedAt: new Date().toISOString() })}\n\n`);
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    await handleStatic(request, response);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Expo Live Lens dashboard is already running or port ${port} is in use.`);
    console.error(`Open http://localhost:${port} or stop the existing process before starting another dashboard.`);
    process.exit(1);
  }

  throw error;
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Expo Live Lens dashboard: http://localhost:${port}`);
});
