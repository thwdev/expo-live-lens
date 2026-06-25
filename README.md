# Expo Live Lens

**Open-source AI devtools for Expo Go and React Native. Inspect a real phone app with screenshots, logs, network events, replay sessions, and copy-ready prompts for Codex, Claude, or any AI coding agent.**

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Expo SDK 54](https://img.shields.io/badge/Expo%20SDK-54-000020.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-devtools-61dafb.svg)](https://reactnative.dev/)
[![AI assisted](https://img.shields.io/badge/AI-Codex%20%2B%20Claude-blue.svg)](#agent-integrations)

Expo Live Lens is a local, Expo Go-first live review dashboard for mobile developers who want an AI assistant to see what is actually happening inside the app.

It helps with the annoying loop:

```text
run app on phone -> scan QR -> find bug/UI issue -> explain screen to AI -> edit code -> verify again
```

Instead of manually describing every screen, Expo Live Lens gives your AI agent a small local context feed:

- screenshots on demand
- console logs and runtime errors
- app state and custom events
- lightweight JS `fetch` network summaries
- route/screen context
- replay timeline
- recorded mobile sessions
- copy-ready AI review prompts

It is designed as a free, local, Radon-like companion for Expo Go workflows. It is not a full Radon replacement, native inspector, or cloud service. It is a practical bridge between your running Expo app and AI-assisted coding.

## Contents

- [Why Use It](#why-use-it)
- [Features](#features)
- [Quick Start](#quick-start)
- [Add To An Existing Expo App](#add-to-an-existing-expo-app)
- [AI Review Workflow](#ai-review-workflow)
- [Agent Integrations](#agent-integrations)
- [Useful Commands](#useful-commands)
- [API Endpoints](#api-endpoints)
- [Privacy And Security](#privacy-and-security)
- [Roadmap](#roadmap)

## Why Use It

Most AI coding assistants are strong with source code but weak with live mobile context. Expo Live Lens narrows that gap for Expo Go and React Native development.

Use it when:

- you build with Expo Go on a real iPhone or Android device
- you want Codex, Claude, or another AI agent to review the visible screen
- you want smaller prompts instead of dumping screenshots constantly
- you want logs, errors, network activity, and screenshots in one local dashboard
- you want to record a mobile flow and ask an AI what to fix next

## Features

### Live Expo Go dashboard

- Local dashboard at `http://localhost:4317`
- Works with physical devices over LAN
- Server-sent event stream for live updates
- Dashboard health endpoint for agents

### AI-ready context

- Low-token `summary.json`
- Copy-ready review prompts for UI, bugs, polish, performance, accessibility, and mobile coaching
- Mobile insights with issues, quality gates, strengths, and next actions
- Review packets that combine latest screenshot metadata with recent events

### Screenshots without token waste

- Manual-first capture mode
- Capture request button/API
- Duplicate screenshot suppression
- Configurable screenshot quality
- Latest-vs-previous screenshot comparison
- Retained screenshot history

### Runtime debugging

- Console log capture
- Global error capture
- App state events
- Custom events from your app
- JS `fetch` network summaries
- Failed request detection

### Replay sessions

- Start and stop named mobile flow recordings
- Pull a session packet after testing a flow
- Generate a session-specific AI review prompt
- Persist stopped sessions locally under `tmp/live-lens-sessions`

### Agent workflow

- Codex run actions in `.codex/environments/environment.toml`
- Codex Skill in `skills/expo-live-lens`
- Claude Code command in `.claude/commands/expo-live-lens.md`
- Scripts for capture, review prompts, timeline, mobile insights, and sessions

## Architecture

```text
Expo Go app
  -> LiveLensRoot wrapper
  -> local dashboard server
  -> summary, screenshots, timeline, sessions
  -> Codex / Claude / AI review loop
  -> code changes
  -> fresh capture for verification
```

Screenshots, review packets, and recorded sessions stay local by default. Generated review artifacts are written under `tmp/`, which is gitignored.

## Quick Start

Install dependencies:

```bash
npm install
```

Start the dashboard:

```bash
npm.cmd run dev
```

Open the dashboard:

```text
http://localhost:4317
```

Start the Expo SDK 54 demo app in another terminal:

```cmd
set EXPO_PUBLIC_LIVE_LENS_URL=http://YOUR_COMPUTER_IP:4317
npm.cmd run dev:demo:offline
```

Scan the QR code with Expo Go.

Pull the smallest useful AI context first:

```bash
npm.cmd run mobile:insights
```

Request a fresh screenshot and review packet:

```bash
npm.cmd run review:now
```

Generated files are written to:

```text
tmp/live-lens-review/
```

## Add To An Existing Expo App

Run the setup helper from this repository:

```bash
npm run setup:app -- C:\path\to\your\expo-app
```

Install the screenshot dependency in the target Expo app:

```bash
npx expo install react-native-view-shot
```

Wrap your app root:

```tsx
import { LiveLensRoot } from "./src/dev/live-lens";

export default function App() {
  return (
    <LiveLensRoot
      serverUrl="http://YOUR_COMPUTER_IP:4317"
      screenName="Home"
      route="/"
      captureMode="manual"
      screenshotQuality={0.58}
      captureNetwork
    >
      {/* your app */}
    </LiveLensRoot>
  );
}
```

For Expo Router, wrap your root `Stack` or `Slot` in `app/_layout.tsx`.

The setup helper:

- copies `src/dev/live-lens.tsx` into the target app
- tries to auto-wrap `App.tsx` or `app/_layout.tsx`
- writes a local backup before changing the entry file
- writes `LIVE_LENS_SETUP.md` with a fallback snippet
- detects a likely LAN IP for physical-device testing

## AI Review Workflow

### Quick UI review

```bash
npm.cmd run capture:now
npm.cmd run review:prompt -- ui
```

Then ask your AI agent to use the generated prompt and latest screenshot.

### Bug triage

```bash
npm.cmd run review:prompt -- bug
```

This focuses the AI on runtime errors, failed network requests, broken flows, and likely debugging steps.

### Mobile development coach

```bash
npm.cmd run mobile:insights
npm.cmd run review:mobile
```

This is the best default when you want a senior mobile-development style review across UX, state, runtime health, and testability.

### Record a flow

```bash
npm.cmd run session:start
# perform the flow on the phone
npm.cmd run session:stop
npm.cmd run session:pull
```

The session packet and prompt are saved under `tmp/live-lens-review/`.

## Agent Integrations

Expo Live Lens includes portable instructions for AI coding tools.

### Codex

- Codex Skill: [skills/expo-live-lens/SKILL.md](skills/expo-live-lens/SKILL.md)
- Codex actions: [.codex/environments/environment.toml](.codex/environments/environment.toml)
- Run scripts: [script/build_and_run.ps1](script/build_and_run.ps1) and [script/build_and_run.sh](script/build_and_run.sh)

Copy the skill into `~/.codex/skills/expo-live-lens` or keep it in this repo for reference. Then you can ask:

```text
Use $expo-live-lens to inspect my running Expo app and suggest the next best mobile improvements.
```

### Claude Code

- Claude command: [.claude/commands/expo-live-lens.md](.claude/commands/expo-live-lens.md)

Use it as a project command/instruction for Claude Code so it follows the same capture, review, session, and privacy workflow.

### Future MCP plugin

A real MCP/plugin layer can expose dashboard actions as direct tools:

- `health`
- `capture_now`
- `mobile_insights`
- `start_session`
- `stop_session`
- `pull_session`
- `review_prompt`

The current skill/command approach is intentionally lightweight and GitHub-friendly while the API stabilizes.

## Capture Strategy

Use `manual` for the lowest network and token usage:

```tsx
<LiveLensRoot serverUrl="http://YOUR_COMPUTER_IP:4317" captureMode="manual" />
```

Use `interval` only when you need periodic screenshots:

```tsx
<LiveLensRoot
  serverUrl="http://YOUR_COMPUTER_IP:4317"
  captureMode="interval"
  captureIntervalMs={5000}
  screenshotQuality={0.45}
/>
```

Disable screenshots on sensitive screens:

```tsx
<LiveLensRoot serverUrl="http://YOUR_COMPUTER_IP:4317" captureScreenshots={false} />
```

Request a capture after important actions:

```tsx
const lens = useLiveLens({ serverUrl: "http://YOUR_COMPUTER_IP:4317" });

lens.sendEvent("counter", { value: next });
lens.requestCapture("counter");
```

That pattern avoids constant screenshot streaming while still giving the AI a fresh screen after meaningful changes.

## Useful Commands

The examples use `npm.cmd` for Windows. On macOS/Linux, use `npm run ...`.

```bash
npm.cmd run dev
npm.cmd run dev:demo
npm.cmd run dev:demo:offline
npm.cmd run review:summary
npm.cmd run review:pull
npm.cmd run review:prompt -- ui
npm.cmd run review:prompt -- bug
npm.cmd run review:mobile
npm.cmd run mobile:insights
npm.cmd run timeline:pull
npm.cmd run capture:now
npm.cmd run session:start
npm.cmd run session:stop
npm.cmd run session:pull
npm.cmd run review:now
npm.cmd run check
```

Use `mobile:insights` first when you want minimal AI context. Use `review:now` when you need a fresh screenshot. Use `session:*` commands when testing a real mobile flow.

## API Endpoints

### Health and events

- `GET /api/health`
- `GET /api/events`
- `DELETE /api/events`
- `POST /api/events`
- `GET /api/events/stream`

### AI context

- `GET /api/summary`
- `GET /api/mobile-insights`
- `GET /api/review-packet`
- `GET /api/review-prompt?mode=quick|ui|bug|polish|perf|mobile|accessibility`

### Screenshots

- `POST /api/capture-request`
- `GET /api/capture-request`
- `GET /api/latest-screenshot.jpg`
- `GET /api/screenshots`
- `GET /api/screenshots/compare`
- `GET /api/screenshots/:id.jpg`

### Timeline and sessions

- `GET /api/timeline?limit=30`
- `GET /api/sessions`
- `POST /api/sessions/start`
- `POST /api/sessions/stop`
- `GET /api/sessions/:id/packet`
- `GET /api/sessions/:id/review-prompt?mode=mobile`

## Current Limitations

- Expo Go cannot load arbitrary custom native modules.
- Physical iOS automation from Windows is limited.
- Full element-to-source inspection is not implemented yet.
- Network inspection currently covers JS `fetch` calls only.
- Setup helper copies the client instead of installing a published package.
- The MCP/plugin layer is planned but not implemented yet.

## Roadmap

Near-term priorities:

1. Redaction controls for tokens, emails, private IPs, cookies, and sensitive payloads
2. Retention settings for screenshots, events, and persisted sessions
3. Safer AST-based setup for more Expo entrypoint patterns
4. Published package and CLI, for example `npx expo-live-lens setup`
5. MCP server/plugin tools for Codex, Claude, Cursor, and other agent clients
6. Better Expo Router context, source-file hints, and replay-aware prompts

See [docs/roadmap.md](docs/roadmap.md) for more ideas.

## Privacy And Security

The dashboard is local, but it binds to `0.0.0.0` so physical phones can reach it over LAN. Use it only on trusted networks. Do not expose it to the public internet.

Screenshots, logs, network payloads, and session packets can contain sensitive data. Review artifacts are written under `tmp/`, which is gitignored, but you should still clear local data before switching to sensitive app work.

See [SECURITY.md](SECURITY.md) for the current policy and recommended use.

## SEO Keywords

Expo Go devtools, React Native devtools, Expo debugging, Expo Go inspector, React Native inspector, AI mobile development, AI coding assistant, Codex Expo workflow, Claude Code Expo workflow, Expo Router debugging, mobile UI review, screenshot review, Radon alternative, local Expo dashboard.

## Contributing

Issues and ideas are welcome. Good first areas:

- privacy and redaction
- setup helper improvements
- Expo Router integration
- dashboard UX
- MCP/plugin tools
- examples for real Expo apps

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
