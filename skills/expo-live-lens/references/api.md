# Expo Live Lens API Reference

Use these endpoints when scripts are unavailable or direct inspection is faster.

## Core

- `GET /api/health`: dashboard status, limits, active session, connected clients.
- `GET /api/summary`: compact current-state summary.
- `GET /api/mobile-insights`: prioritized mobile development issues, quality gates, next actions.
- `GET /api/review-prompt?mode=quick|ui|bug|polish|perf|mobile|accessibility`: copy-ready AI prompt.
- `GET /api/review-packet`: larger packet with summary, latest screenshot metadata, and recent events.

## Capture

- `POST /api/capture-request`: ask connected app to send a screenshot.
- `GET /api/capture-request`: latest capture request seen by clients.
- `GET /api/latest-screenshot.jpg`: latest retained screenshot.
- `GET /api/screenshots`: retained screenshot history.
- `GET /api/screenshots/compare`: latest-vs-previous metadata.
- `GET /api/screenshots/:id.jpg`: retained screenshot by id.

## Timeline

- `GET /api/events`: raw retained events.
- `DELETE /api/events`: clear events and persisted sessions.
- `GET /api/events/stream`: server-sent live event stream.
- `GET /api/timeline?limit=30`: replay-friendly event timeline.

## Sessions

- `GET /api/sessions`: active and recorded sessions.
- `POST /api/sessions/start` with `{ "name": "Flow name" }`: begin a recorded flow.
- `POST /api/sessions/stop`: stop the current flow.
- `GET /api/sessions/latest/packet`: latest session packet.
- `GET /api/sessions/latest/review-prompt?mode=mobile`: session review prompt.

## Prompt Modes

- `quick`: concise sanity check.
- `ui`: layout, hierarchy, spacing, contrast, polish.
- `bug`: runtime errors, broken flows, network failures.
- `polish`: small realistic improvements.
- `perf`: noisy captures, network churn, wasteful runtime behavior.
- `mobile`: senior mobile development review across UX/runtime/testability.
- `accessibility`: text, contrast, tap targets, screen-reader-friendly states.
