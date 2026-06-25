---
name: expo-live-lens
description: Live Expo Go and React Native development workflow using Expo Live Lens. Use when the user wants an AI agent to inspect a running mobile app, request screenshots, review logs/network/errors, record a mobile flow, pull review prompts, improve an Expo UI from live context, set up LiveLensRoot in an Expo app, or debug the local Expo Live Lens dashboard.
---

# Expo Live Lens

## Overview

Use Expo Live Lens as the local bridge between a running Expo Go app and an AI coding agent. Prefer this workflow when visual app state, logs, network events, route context, or recorded mobile flows should guide code changes.

## Decision Flow

1. If the user wants to inspect the current app state, verify the dashboard is running and read `/api/health`.
2. If no screenshot is available, request one with `npm run capture:now` or `POST /api/capture-request`.
3. If the user is testing a flow, start a session before the flow and stop it afterward.
4. Pull the smallest useful context first: `mobile:insights`, then `review:prompt`, then full packets only when needed.
5. Make code edits based on the live evidence, then request another capture and compare before/after.

## Dashboard Commands

Run these from the Expo Live Lens repo root unless a project-specific action exists:

```bash
npm run dev
npm run capture:now
npm run mobile:insights
npm run review:prompt -- ui
npm run review:prompt -- bug
npm run session:start
npm run session:stop
npm run session:pull
npm run timeline:pull
```

Use `LIVE_LENS_SERVER_URL` when the dashboard is on another host or port:

```bash
LIVE_LENS_SERVER_URL=http://localhost:4317 npm run mobile:insights
```

On Windows PowerShell:

```powershell
$env:LIVE_LENS_SERVER_URL="http://localhost:4317"
npm run mobile:insights
```

## Agent Workflow

For quick review:

1. Check `GET http://localhost:4317/api/health`.
2. Run `npm run capture:now`.
3. Pull `npm run mobile:insights`.
4. Pull `npm run review:prompt -- mobile` only if more context is needed.
5. Edit the app, then request another capture.

For a user flow:

1. Run `npm run session:start -- "Flow name"` if the script supports args, or call `node scripts/session.mjs start "Flow name"`.
2. Ask the user to perform the flow on the phone, or continue when events arrive.
3. Run `npm run session:stop`.
4. Run `npm run session:pull`.
5. Use the generated session prompt under `tmp/live-lens-review/` as the main review context.

For setup in another Expo app:

1. Run `npm run setup:app -- <path-to-expo-app>`.
2. Ensure `react-native-view-shot` is installed with Expo.
3. Wrap the app root with `LiveLensRoot`.
4. Set `EXPO_PUBLIC_LIVE_LENS_URL` to the LAN dashboard URL for physical devices.
5. Keep screenshots disabled or redacted for sensitive screens.

## Evidence Rules

- Prefer live facts from `/api/summary`, `/api/mobile-insights`, `/api/timeline`, and session packets over guessing from code alone.
- Use screenshots for layout, visual hierarchy, spacing, touch-target, and polish issues.
- Use logs/errors/network events for runtime and data-flow issues.
- Use route context when available to find likely source files.
- Keep prompts small: mobile insights first, full review packet only when necessary.

## Privacy Rules

- Treat screenshots, logs, network payloads, and session packets as local sensitive data.
- Do not paste raw packets into public issues when they include secrets or personal data.
- Redact Authorization headers, tokens, emails, private IPs, cookies, and customer data before sharing.
- Clear local data with `DELETE /api/events` or dashboard controls before switching to sensitive app work.
- Remember that recorded sessions persist under `tmp/live-lens-sessions`, which should be gitignored.

## Troubleshooting

- If `EADDRINUSE` appears, another dashboard is already using port `4317`; either reuse it or stop that process.
- If the phone does not connect, confirm the phone and computer are on the same network and use the computer LAN IP, not `localhost`.
- If screenshots do not arrive, confirm `react-native-view-shot` is installed and `captureScreenshots` is enabled.
- If context is too noisy, lower screenshot retention and rely on manual capture plus sessions.

## References

Read `references/api.md` when endpoint details or prompt modes are needed.
