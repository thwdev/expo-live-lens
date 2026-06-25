import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = normalize(join(__dirname, ".."));
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT || 4317);
const maxEvents = Number(process.env.LENS_MAX_EVENTS || 200);
const maxScreenshotImages = Number(process.env.LENS_MAX_SCREENSHOT_IMAGES || 3);
const maxPromptEvents = Number(process.env.LENS_MAX_PROMPT_EVENTS || 18);
const sessionDir = normalize(process.env.LENS_SESSION_DIR || join(rootDir, "tmp", "live-lens-sessions"));

const events = [];
const sessions = [];
const clients = new Set();
let latestCaptureRequest = null;
let activeSessionId = null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const reviewModes = {
  quick: {
    label: "Quick",
    focus:
      "Give a fast sanity-check of the current app state. Prioritize the highest-signal issues first and keep the answer concise."
  },
  ui: {
    label: "UI Review",
    focus:
      "Focus on layout, hierarchy, spacing, contrast, polish, and anything visually confusing on the current screen."
  },
  bug: {
    label: "Bug Triage",
    focus:
      "Focus on likely bugs, broken flows, recent errors, failed network activity, and the most probable debugging next steps."
  },
  polish: {
    label: "Polish",
    focus:
      "Suggest improvements that are realistic to implement quickly: tighter spacing, clearer labels, better states, and cleaner interaction feedback."
  },
  perf: {
    label: "Performance",
    focus:
      "Focus on wasted work, noisy logging, excessive captures, network churn, and any runtime signals that suggest avoidable overhead."
  },
  mobile: {
    label: "Mobile Dev Coach",
    focus:
      "Think like a senior mobile developer. Prioritize the next best action across UX, navigation, runtime errors, network behavior, responsiveness, and testability."
  },
  accessibility: {
    label: "Accessibility",
    focus:
      "Focus on mobile accessibility risks: readable text, tap targets, contrast, form clarity, state feedback, and screen-reader-friendly interaction patterns."
  }
};

function addEvent(input) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    receivedAt: new Date().toISOString(),
    ...input
  };

  if (activeSessionId && !event.sessionId) {
    event.sessionId = activeSessionId;
  }

  events.unshift(event);
  if (event.sessionId) {
    const session = getSessionById(event.sessionId);
    if (session) {
      session.eventIds.unshift(event.id);
      session.eventLog ||= [];
      session.eventLog.unshift(cloneJson(event));
    }
    persistSessionSoon(session);
  }
  pruneEvents();

  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(line);
  }

  return event;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSessionFilePath(id) {
  return join(sessionDir, `${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

function createPersistedSessionPayload(session) {
  const { eventLog, ...sessionMeta } = session;

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    session: sessionMeta,
    events: eventLog || getSessionEvents(session)
  };
}

function persistSessionSoon(session) {
  if (!session) {
    return;
  }

  persistSession(session).catch((error) => {
    console.warn(`Failed to persist session ${session.id}: ${error.message}`);
  });
}

async function persistSession(session) {
  if (!session) {
    return;
  }

  await mkdir(sessionDir, { recursive: true });
  await writeFile(getSessionFilePath(session.id), JSON.stringify(createPersistedSessionPayload(session), null, 2));
}

async function hydratePersistedSessions() {
  if (!existsSync(sessionDir)) {
    return;
  }

  const files = (await readdir(sessionDir)).filter((file) => file.endsWith(".json")).sort();
  const seenSessionIds = new Set(sessions.map((session) => session.id));
  const seenEventIds = new Set(events.map((event) => event.id));

  for (const file of files) {
    try {
      const payload = JSON.parse(await readFile(join(sessionDir, file), "utf8"));
      if (!payload.session?.id || seenSessionIds.has(payload.session.id)) {
        continue;
      }

      payload.session.endedAt = payload.session.endedAt || null;
      payload.session.stopReason = payload.session.stopReason || "persisted";
      payload.session.eventIds = Array.isArray(payload.session.eventIds) ? payload.session.eventIds : [];
      payload.session.eventLog = Array.isArray(payload.events) ? payload.events : [];
      sessions.push(payload.session);
      seenSessionIds.add(payload.session.id);

      for (const event of payload.events || []) {
        if (!event?.id || seenEventIds.has(event.id)) {
          continue;
        }

        events.push(cloneJson(event));
        seenEventIds.add(event.id);
      }
    } catch (error) {
      console.warn(`Failed to load persisted session ${file}: ${error.message}`);
    }
  }

  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  events.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  activeSessionId = sessions.find((session) => !session.endedAt)?.id || null;
  pruneEvents();
}

function getSessionById(id) {
  return sessions.find((session) => session.id === id) || null;
}

function getActiveSession() {
  return activeSessionId ? getSessionById(activeSessionId) : null;
}

function getSessionEvents(session) {
  if (!session) {
    return [];
  }

  const allowedIds = new Set(session.eventIds);
  const merged = [...(session.eventLog || []), ...events.filter((event) => allowedIds.has(event.id) || event.sessionId === session.id)];
  const seen = new Set();

  return merged
    .filter((event) => {
      if (!event?.id || seen.has(event.id)) {
        return false;
      }

      seen.add(event.id);
      return true;
    })
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

function getSessionScreenshots(session) {
  return getSessionEvents(session)
    .filter((event) => event.type === "screenshot")
    .map((event) => ({
      id: event.id,
      receivedAt: event.receivedAt,
      screenName: event.screenName || null,
      device: event.device || null,
      captureReason: event.payload?.captureReason || null,
      retained: Boolean(event.image),
      imageUrl: event.image ? `/api/screenshots/${encodeURIComponent(event.id)}.jpg` : null
    }));
}

function createSessionSummary(session) {
  const sessionEvents = getSessionEvents(session);
  const screenshots = getSessionScreenshots(session);
  const networkEvents = sessionEvents.filter((event) => event.type === "network" || event.type === "network-error");
  const failedNetworkEvents = networkEvents.filter(
    (event) => event.type === "network-error" || event.payload?.ok === false || Number(event.payload?.status || 0) >= 400
  );
  const errorEvents = sessionEvents.filter((event) => event.type === "error" || event.level === "error");

  return {
    id: session.id,
    name: session.name,
    status: session.endedAt ? "stopped" : "recording",
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: (session.endedAt ? new Date(session.endedAt) : new Date()).getTime() - new Date(session.startedAt).getTime(),
    eventCount: sessionEvents.length,
    screenshotCount: screenshots.length,
    retainedScreenshotCount: screenshots.filter((screenshot) => screenshot.retained).length,
    errorCount: errorEvents.length,
    network: {
      total: networkEvents.length,
      failed: failedNetworkEvents.length
    },
    latestEventAt: sessionEvents[0]?.receivedAt || null,
    latestScreenshot: screenshots.find((screenshot) => screenshot.retained) || null
  };
}

function listSessions() {
  return sessions.map((session) => createSessionSummary(session));
}

function stopActiveSession(reason = "manual") {
  const active = getActiveSession();
  if (!active) {
    return null;
  }

  active.endedAt = new Date().toISOString();
  active.stopReason = reason;
  activeSessionId = null;

  addEvent({
    type: "session-stop",
    sessionId: active.id,
    payload: {
      reason,
      session: createSessionSummary(active)
    }
  });

  return active;
}

function startSession(name = "Mobile flow") {
  if (activeSessionId) {
    stopActiveSession("new-session-started");
  }

  const session = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    startedAt: new Date().toISOString(),
    endedAt: null,
    stopReason: null,
    eventIds: []
  };

  sessions.unshift(session);
  sessions.splice(20);
  activeSessionId = session.id;

  addEvent({
    type: "session-start",
    sessionId: session.id,
    payload: {
      session: createSessionSummary(session)
    }
  });

  return session;
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

async function clearEvents() {
  events.splice(0, events.length);
  sessions.splice(0, sessions.length);
  activeSessionId = null;
  await rm(sessionDir, { recursive: true, force: true });
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

function getScreenshotById(id) {
  return events.find((event) => event.id === id && event.type === "screenshot" && event.image);
}

function getRetainedScreenshots() {
  return events
    .filter((event) => event.type === "screenshot" && event.image)
    .map((event) => ({
      id: event.id,
      receivedAt: event.receivedAt,
      screenName: event.screenName || null,
      device: event.device || null,
      captureReason: event.payload?.captureReason || null,
      fingerprint: event.payload?.fingerprint || null,
      imageUrl: `/api/screenshots/${encodeURIComponent(event.id)}.jpg`
    }));
}

function getNonScreenshotEvents() {
  return events.filter((event) => event.type !== "screenshot");
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

function sanitizeEvent(event, options = {}) {
  const { includeImage = false } = options;

  return {
    ...event,
    image: includeImage ? event.image : undefined
  };
}

function getRouteHistory(nonScreenshotEvents) {
  const history = [];
  const seen = new Set();

  for (const event of nonScreenshotEvents) {
    const route = event.payload?.route;
    const screenName = event.screenName || event.payload?.screenName || null;
    const key = route || screenName;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    history.push({
      route: route || null,
      screenName,
      receivedAt: event.receivedAt
    });

    if (history.length >= 6) {
      break;
    }
  }

  return history;
}

function getRecentActions(nonScreenshotEvents) {
  return nonScreenshotEvents
    .filter(
      (event) =>
        !["console", "app-state", "capture-request", "route"].includes(event.type) &&
        !event.type.startsWith("screenshot")
    )
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      type: event.type,
      level: event.level || null,
      receivedAt: event.receivedAt,
      screenName: event.screenName || null,
      payload: event.payload || null
    }));
}

function getConsoleStats(nonScreenshotEvents) {
  const consoleEvents = nonScreenshotEvents.filter((event) => event.type === "console");

  return {
    total: consoleEvents.length,
    error: consoleEvents.filter((event) => event.level === "error").length,
    warn: consoleEvents.filter((event) => event.level === "warn").length,
    info: consoleEvents.filter((event) => event.level === "info").length,
    log: consoleEvents.filter((event) => event.level === "log").length
  };
}

function getScreenshotStats() {
  const screenshotEvents = events.filter((event) => event.type === "screenshot");
  const screenshotErrors = events.filter((event) => event.type === "screenshot-error");
  const screenshotSkips = events.filter((event) => event.type === "screenshot-skip");
  const latestScreenshot = getLatestScreenshot();
  const retainedScreenshots = getRetainedScreenshots();

  return {
    total: screenshotEvents.length,
    retainedImages: retainedScreenshots.length,
    skippedDuplicates: screenshotSkips.filter((event) => event.payload?.reason === "duplicate").length,
    errors: screenshotErrors.length,
    latestReason: latestScreenshot?.payload?.captureReason || null,
    retained: retainedScreenshots.slice(0, maxScreenshotImages)
  };
}

function buildReviewHints(summary) {
  const hints = [];

  if (!summary.latestScreenshot) {
    hints.push("No screenshot is available yet. Request a fresh capture before doing a visual review.");
  }

  if (summary.latestError) {
    hints.push("There is a recent runtime error. Start with bug triage before UI polish.");
  }

  if (summary.network.failed > 0) {
    hints.push("Recent network failures were detected. Check whether the visible UI reflects those failures well.");
  }

  if (summary.screenshot.skippedDuplicates > 0) {
    hints.push("Duplicate screenshots are being skipped, which lowers noise and token usage.");
  }

  if (!summary.route) {
    hints.push("Route context is sparse. Add explicit route metadata if this screen belongs to a deeper flow.");
  }

  if (summary.console.warn + summary.console.error > 0) {
    hints.push("Console warnings or errors were seen recently. Review them before trusting the current screen.");
  }

  return hints;
}

function getLastEventTime() {
  return events[0]?.receivedAt || null;
}

function getTimeline(nonScreenshotEvents) {
  return nonScreenshotEvents.slice(0, 14).map((event) => ({
    id: event.id,
    type: event.type,
    level: event.level || null,
    receivedAt: event.receivedAt,
    screenName: event.screenName || null,
    detail:
      event.payload?.action ||
      event.payload?.route ||
      event.payload?.url ||
      event.payload?.state ||
      event.payload?.reason ||
      null
  }));
}

function getReplayTimeline(limit = 30) {
  return events.slice(0, limit).map((event) => ({
    id: event.id,
    type: event.type,
    level: event.level || null,
    receivedAt: event.receivedAt,
    screenName: event.screenName || null,
    device: event.device || null,
    hasImage: Boolean(event.image),
    imageUrl: event.type === "screenshot" && event.image ? `/api/screenshots/${encodeURIComponent(event.id)}.jpg` : null,
    summary:
      event.payload?.action ||
      event.payload?.route ||
      event.payload?.url ||
      event.payload?.state ||
      event.payload?.reason ||
      event.payload?.captureReason ||
      event.payload?.status ||
      event.level ||
      null
  }));
}

function getScreenshotCompare() {
  const retained = getRetainedScreenshots();

  return {
    createdAt: new Date().toISOString(),
    current: retained[0] || null,
    previous: retained[1] || null,
    retained
  };
}

function createIssue(id, severity, title, detail, action) {
  return {
    id,
    severity,
    title,
    detail,
    action
  };
}

function buildMobileInsights(summary, nonScreenshotEvents) {
  const issues = [];
  const nextActions = [];
  const strengths = [];

  if (summary.latestError) {
    issues.push(
      createIssue(
        "runtime-error",
        "high",
        "Runtime error needs attention",
        `Latest error: ${summary.latestError.type} on ${summary.latestError.screenName || "unknown screen"}.`,
        "Run a bug review, inspect the error payload, and fix this before polishing UI."
      )
    );
  }

  if (summary.network.failed > 0) {
    issues.push(
      createIssue(
        "network-failures",
        "high",
        "Network failures detected",
        `${summary.network.failed} failed network event(s) are in the current session.`,
        "Check failed status codes, loading states, retry paths, and user-facing error copy."
      )
    );
  }

  if (!summary.latestScreenshot) {
    issues.push(
      createIssue(
        "missing-screenshot",
        "medium",
        "No current screenshot",
        "The AI cannot do a visual mobile review without a recent screen capture.",
        "Request a screenshot after navigating to the state you care about."
      )
    );
  }

  if (!summary.route) {
    issues.push(
      createIssue(
        "missing-route-context",
        "medium",
        "Route context is incomplete",
        "The current screen is not tied to a clear route, which makes source-file guidance weaker.",
        "Pass route and routeParams into LiveLensRoot or a route helper near your navigator."
      )
    );
  }

  if (summary.console.warn > 0) {
    issues.push(
      createIssue(
        "console-warnings",
        "low",
        "Console warnings are present",
        `${summary.console.warn} warning(s) were observed.`,
        "Review warnings before shipping; warnings often hide layout, deprecated API, or state issues."
      )
    );
  }

  if (summary.screenshot.skippedDuplicates > 0) {
    strengths.push("Duplicate screenshot suppression is active, which keeps AI context smaller.");
  }

  if (summary.latestScreenshot) {
    strengths.push("A current screenshot is available for visual review.");
  }

  if (summary.route) {
    strengths.push("Route context is available, so review prompts can be more specific.");
  }

  if (summary.network.total > 0 && summary.network.failed === 0) {
    strengths.push("Network activity is visible and currently has no failures.");
  }

  if (!summary.latestError && summary.network.failed === 0) {
    nextActions.push({
      id: "review-ui",
      label: "Review visible UI",
      command: "review-ui",
      reason: "The runtime looks stable enough to focus on layout, hierarchy, and polish."
    });
  }

  if (summary.latestError || summary.network.failed > 0) {
    nextActions.push({
      id: "review-bugs",
      label: "Review bugs first",
      command: "review-bug",
      reason: "Errors or failed requests should be handled before visual polish."
    });
  }

  nextActions.push({
    id: "capture-now",
    label: "Capture current screen",
    command: "capture-now",
    reason: summary.latestScreenshot ? "Use this after each meaningful UI change." : "Needed before visual review."
  });

  nextActions.push({
    id: "add-route-context",
    label: "Improve route context",
    command: "add-route-context",
    reason: summary.route ? "Route context exists; add params for deeper flows." : "Route context is missing."
  });

  return {
    createdAt: new Date().toISOString(),
    status:
      summary.latestError || summary.network.failed > 0
        ? "needs-attention"
        : summary.latestScreenshot
          ? "ready-for-review"
          : "waiting-for-app",
    lastEventAt: getLastEventTime(),
    issues,
    nextActions,
    strengths,
    timeline: getTimeline(nonScreenshotEvents),
    replayTimeline: getReplayTimeline(16),
    qualityGates: {
      screenshotReady: Boolean(summary.latestScreenshot),
      routeContextReady: Boolean(summary.route),
      noRuntimeErrors: !summary.latestError,
      noNetworkFailures: summary.network.failed === 0,
      lowNoiseCapture: summary.screenshot.skippedDuplicates > 0 || summary.screenshot.total <= 4
    }
  };
}

function getSummary() {
  const nonScreenshotEvents = getNonScreenshotEvents();
  const latestScreenshot = getLatestScreenshot();
  const latestError = nonScreenshotEvents.find((event) => event.type === "error" || event.level === "error") || null;
  const latestWarning = nonScreenshotEvents.find((event) => event.level === "warn") || null;
  const routeEvents = nonScreenshotEvents.filter(
    (event) => event.type === "route" || event.payload?.route || event.payload?.screenName
  );
  const latestRouteEvent = routeEvents[0] || null;
  const networkEvents = nonScreenshotEvents.filter((event) => event.type === "network" || event.type === "network-error");
  const failedNetworkEvents = networkEvents.filter(
    (event) => event.type === "network-error" || event.payload?.ok === false || Number(event.payload?.status || 0) >= 400
  );
  const summary = {
    createdAt: new Date().toISOString(),
    eventCount: events.length,
    latestScreenshot: latestScreenshot
      ? {
          id: latestScreenshot.id,
          receivedAt: latestScreenshot.receivedAt,
          screenName: latestScreenshot.screenName,
          device: latestScreenshot.device,
          captureReason: latestScreenshot.payload?.captureReason || null,
          imageUrl: `/api/screenshots/${encodeURIComponent(latestScreenshot.id)}.jpg`
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
    latestWarning: latestWarning
      ? {
          id: latestWarning.id,
          receivedAt: latestWarning.receivedAt,
          type: latestWarning.type,
          level: latestWarning.level,
          screenName: latestWarning.screenName,
          payload: latestWarning.payload
        }
      : null,
    route: latestRouteEvent?.payload?.route || null,
    routeParams: latestRouteEvent?.payload?.routeParams || null,
    routeHistory: getRouteHistory(routeEvents),
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
    console: getConsoleStats(nonScreenshotEvents),
    screenshot: getScreenshotStats(),
    recentActions: getRecentActions(nonScreenshotEvents),
    recentEventTypes: nonScreenshotEvents.slice(0, 12).map((event) => ({
      type: event.type,
      level: event.level || null,
      receivedAt: event.receivedAt,
      screenName: event.screenName || null
    }))
  };

  summary.reviewHints = buildReviewHints(summary);
  summary.mobileInsights = buildMobileInsights(summary, nonScreenshotEvents);
  return summary;
}

function getMobileInsights() {
  const nonScreenshotEvents = getNonScreenshotEvents();
  const summary = getSummary();

  return {
    ...summary.mobileInsights,
    summary: {
      createdAt: summary.createdAt,
      screenName: summary.screenName,
      route: summary.route,
      appState: summary.appState,
      latestScreenshot: summary.latestScreenshot,
      latestError: summary.latestError,
      network: summary.network,
      console: summary.console,
      screenshot: summary.screenshot
    },
    recentActions: summary.recentActions,
    timeline: getTimeline(nonScreenshotEvents),
    replayTimeline: getReplayTimeline(30)
  };
}

function getReviewPacket() {
  const latestScreenshot = getLatestScreenshot();
  const recentEvents = getNonScreenshotEvents()
    .slice(0, 50)
    .map((event) => sanitizeEvent(event));

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
          imageUrl: `/api/screenshots/${encodeURIComponent(latestScreenshot.id)}.jpg`
        }
      : null,
    recentEvents
  };
}

function getSessionPacket(id) {
  const session = id === "latest" ? sessions[0] : getSessionById(id);
  if (!session) {
    return null;
  }

  const sessionEvents = getSessionEvents(session);
  const screenshots = getSessionScreenshots(session);

  return {
    createdAt: new Date().toISOString(),
    session: createSessionSummary(session),
    screenshots,
    replayTimeline: sessionEvents.slice(0, 40).map((event) => ({
      id: event.id,
      type: event.type,
      level: event.level || null,
      receivedAt: event.receivedAt,
      screenName: event.screenName || null,
      device: event.device || null,
      hasImage: Boolean(event.image),
      imageUrl: event.type === "screenshot" && event.image ? `/api/screenshots/${encodeURIComponent(event.id)}.jpg` : null,
      summary:
        event.payload?.action ||
        event.payload?.route ||
        event.payload?.url ||
        event.payload?.state ||
        event.payload?.reason ||
        event.payload?.captureReason ||
        event.payload?.status ||
        event.level ||
        null
    })),
    events: sessionEvents.slice(0, 80).map((event) => sanitizeEvent(event))
  };
}

function getSessionPrompt(id, mode = "mobile") {
  const selectedMode = reviewModes[mode] ? mode : "mobile";
  const packet = getSessionPacket(id);

  if (!packet) {
    return null;
  }

  const prompt = [
    "You are reviewing a recorded Expo Go mobile development session captured by Expo Live Lens.",
    `Review mode: ${reviewModes[selectedMode].label}.`,
    reviewModes[selectedMode].focus,
    "Use the session summary, replay timeline, screenshots, and events together.",
    "Respond with:",
    "1. What happened in the flow",
    "2. What looks healthy",
    "3. The most important mobile UX/runtime issues",
    "4. Concrete code or debugging actions",
    "5. A short priority order",
    "",
    "Session:",
    JSON.stringify(packet.session, null, 2),
    "",
    "Screenshots:",
    JSON.stringify(packet.screenshots, null, 2),
    "",
    "Replay timeline:",
    JSON.stringify(packet.replayTimeline, null, 2),
    "",
    "Recent events:",
    JSON.stringify(packet.events.slice(0, maxPromptEvents), null, 2)
  ].join("\n");

  return {
    mode: selectedMode,
    label: reviewModes[selectedMode].label,
    prompt,
    packet
  };
}

function getReviewPrompt(mode = "quick") {
  const selectedMode = reviewModes[mode] ? mode : "quick";
  const packet = getReviewPacket();
  const promptEvents = packet.recentEvents.slice(0, maxPromptEvents).map((event) => ({
    id: event.id,
    type: event.type,
    level: event.level || null,
    receivedAt: event.receivedAt,
    screenName: event.screenName || null,
    payload: event.payload || null
  }));

  const prompt = [
    "You are reviewing a running Expo Go app through Expo Live Lens.",
    `Review mode: ${reviewModes[selectedMode].label}.`,
    reviewModes[selectedMode].focus,
    "Use the summary, recent events, and latest screenshot together.",
    "Also use mobileInsights to decide the next best mobile-development action.",
    "Respond with:",
    "1. What looks healthy",
    "2. The most important issues or risks",
    "3. Concrete code changes or debugging steps",
    "4. A short priority order",
    "",
    "Live summary:",
    JSON.stringify(packet.summary, null, 2),
    "",
    "Recent events:",
    JSON.stringify(promptEvents, null, 2),
    "",
    "Latest screenshot:",
    packet.latestScreenshot
      ? "Use /api/latest-screenshot.jpg or the locally saved screenshot from the review script."
      : "No screenshot is available yet."
  ].join("\n");

  return {
    mode: selectedMode,
    label: reviewModes[selectedMode].label,
    prompt,
    summary: packet.summary,
    latestScreenshot: packet.latestScreenshot,
    recentEvents: promptEvents
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
        maxPromptEvents,
        screenshotImages: events.filter((event) => event.type === "screenshot" && event.image).length,
        latestCaptureRequest,
        clients: clients.size,
        reviewModes: Object.keys(reviewModes),
        activeSession: getActiveSession() ? createSessionSummary(getActiveSession()) : null,
        sessions: sessions.length,
        now: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === "/api/events" && request.method === "GET") {
      sendJson(response, 200, { events });
      return;
    }

    if (url.pathname === "/api/events" && request.method === "DELETE") {
      await clearEvents();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/sessions" && request.method === "GET") {
      sendJson(response, 200, {
        activeSession: getActiveSession() ? createSessionSummary(getActiveSession()) : null,
        sessions: listSessions()
      });
      return;
    }

    if (url.pathname === "/api/sessions/start" && request.method === "POST") {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const session = startSession(payload.name || "Mobile flow");
      sendJson(response, 200, {
        ok: true,
        session: createSessionSummary(session)
      });
      return;
    }

    if (url.pathname === "/api/sessions/stop" && request.method === "POST") {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const session = stopActiveSession(payload.reason || "manual");
      sendJson(response, 200, {
        ok: true,
        session: session ? createSessionSummary(session) : null
      });
      return;
    }

    const sessionPacketMatch = /^\/api\/sessions\/([^/]+)\/packet$/.exec(url.pathname);
    if (sessionPacketMatch && request.method === "GET") {
      const packet = getSessionPacket(decodeURIComponent(sessionPacketMatch[1]));
      if (!packet) {
        sendJson(response, 404, { ok: false, error: "Session not found" });
        return;
      }

      sendJson(response, 200, packet);
      return;
    }

    const sessionPromptMatch = /^\/api\/sessions\/([^/]+)\/review-prompt$/.exec(url.pathname);
    if (sessionPromptMatch && request.method === "GET") {
      const prompt = getSessionPrompt(decodeURIComponent(sessionPromptMatch[1]), url.searchParams.get("mode") || "mobile");
      if (!prompt) {
        sendJson(response, 404, { ok: false, error: "Session not found" });
        return;
      }

      sendJson(response, 200, prompt);
      return;
    }

    if (url.pathname === "/api/review-packet" && request.method === "GET") {
      sendJson(response, 200, getReviewPacket());
      return;
    }

    if (url.pathname === "/api/review-prompt" && request.method === "GET") {
      sendJson(response, 200, getReviewPrompt(url.searchParams.get("mode") || "quick"));
      return;
    }

    if (url.pathname === "/api/mobile-insights" && request.method === "GET") {
      sendJson(response, 200, getMobileInsights());
      return;
    }

    if (url.pathname === "/api/timeline" && request.method === "GET") {
      sendJson(response, 200, {
        createdAt: new Date().toISOString(),
        timeline: getReplayTimeline(Number(url.searchParams.get("limit") || 30))
      });
      return;
    }

    if (url.pathname === "/api/screenshots" && request.method === "GET") {
      sendJson(response, 200, {
        createdAt: new Date().toISOString(),
        screenshots: getRetainedScreenshots()
      });
      return;
    }

    if (url.pathname === "/api/screenshots/compare" && request.method === "GET") {
      sendJson(response, 200, getScreenshotCompare());
      return;
    }

    if (url.pathname === "/api/summary" && request.method === "GET") {
      sendJson(response, 200, getSummary());
      return;
    }

    if (url.pathname.startsWith("/api/screenshots/") && request.method === "GET") {
      const id = decodeURIComponent(url.pathname.replace(/^\/api\/screenshots\//, "").replace(/\.jpg$/, ""));
      const screenshot = getScreenshotById(id);
      const image = parseDataUrl(screenshot?.image);

      if (!image) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Screenshot not available");
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

await hydratePersistedSessions();

server.listen(port, "0.0.0.0", () => {
  console.log(`Expo Live Lens dashboard: http://localhost:${port}`);
});
