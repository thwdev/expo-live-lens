# Expo Live Lens

Expo Live Lens is a local live-review companion for Expo Go apps.

It gives AI coding agents and developers a practical way to inspect a running
Expo app without relying on a custom native build: screenshots, logs, app
state, custom events, lightweight network summaries, and small review packets
that stay on your machine.

This project is aimed at a very specific pain:

- you are building with Expo Go on a real phone
- you want an AI to actually see what the app looks like
- you do not want to manually describe every screen state
- you do not want to stream huge screenshot payloads nonstop

Expo Live Lens is not trying to replace full IDE tooling. It is trying to make
the loop from `running app -> inspect -> suggest fix -> edit code -> verify`
feel immediate and local.

## Why It Exists

Most AI coding workflows are strong at code and weak at runtime context.
Expo Live Lens narrows that gap for Expo Go by turning the running app into a
small local data source that tools like Codex can inspect safely.

The core design goals are:

- Expo Go first
- local by default
- manual or event-driven screenshots instead of constant streaming
- small review payloads before large screenshots
- easy handoff from app state to code changes

## What Works Today

- Local dashboard at `http://localhost:4317`
- Expo Go client wrapper for screenshots, logs, app state, custom events, and JS network summaries
- Manual-first screenshot capture to reduce memory, traffic, and token usage
- `review:summary` for low-token AI context
- `review:now` for fresh screenshot-on-demand review
- Demo app targeting Expo SDK 54
- Setup helper that copies the client into another Expo app

## Architecture

```text
Expo Go app
  -> LiveLensRoot wrapper
  -> local dashboard server
  -> summary + review packet + latest screenshot
  -> AI/code review loop
```

Screenshots stay local by default. Review artifacts are written under `tmp/`,
which is gitignored.

## Quick Start

Install dependencies:

```bash
npm install
```

Start the dashboard:

```bash
npm.cmd run dev
```

Open:

```text
http://localhost:4317
```

Start the SDK 54 demo app in another terminal:

```cmd
set EXPO_PUBLIC_LIVE_LENS_URL=http://YOUR_COMPUTER_IP:4317
npm.cmd run dev:demo:offline
```

Scan the QR code with Expo Go.

Pull the cheapest AI context first:

```bash
npm.cmd run review:summary
```

Request a fresh screenshot review when needed:

```bash
npm.cmd run review:now
```

This writes:

```text
tmp/live-lens-review/summary.json
tmp/live-lens-review/review-packet.json
tmp/live-lens-review/latest-screenshot.jpg
```

## Add To An Existing Expo App

Run the setup helper from this repository:

```bash
npm run setup:app -- C:\path\to\your\expo-app
```

Then install the screenshot dependency in the target app:

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

## Capture Strategy

Use `manual` for the lowest token and network usage:

```tsx
<LiveLensRoot serverUrl="http://YOUR_COMPUTER_IP:4317" captureMode="manual" />
```

Use `interval` only when you really want periodic screenshots:

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

Apps can also request a screenshot after important actions:

```tsx
const lens = useLiveLens({ serverUrl: "http://YOUR_COMPUTER_IP:4317" });

lens.sendEvent("counter", { value: next });
lens.requestCapture("counter");
```

That pattern is a nice middle ground: no constant screenshot stream, but still a
screen update after meaningful user actions.

## Useful Commands

The examples use `npm.cmd` for Windows. On macOS/Linux, use `npm run ...`.

```bash
npm.cmd run dev
npm.cmd run dev:demo
npm.cmd run dev:demo:offline
npm.cmd run review:summary
npm.cmd run review:pull
npm.cmd run review:now
npm.cmd run check
```

Use `review:summary` first when you want minimal AI context. Use `review:now`
when you need a fresh screenshot.

## API Endpoints

- `GET /api/health`
- `GET /api/events`
- `DELETE /api/events`
- `POST /api/events`
- `GET /api/events/stream`
- `GET /api/summary`
- `GET /api/review-packet`
- `GET /api/latest-screenshot.jpg`
- `POST /api/capture-request`
- `GET /api/capture-request`

## Current Limitations

- Expo Go cannot load arbitrary custom native modules.
- Physical iOS automation from Windows is limited.
- Full element-to-source inspection is not implemented yet.
- Network inspection currently covers JS `fetch` calls only.
- Setup helper copies the client instead of installing a published package.

## Strong Ideas

These are the ideas that feel most promising for turning this from a useful MVP
into a genuinely strong developer tool:

- AST-based setup that automatically wraps `App.tsx` or Expo Router layouts
- richer `/api/summary` with interaction, performance, and route transitions
- Expo Router helpers that auto-fill route and params
- dashboard tabs with search, filters, and quick "copy Codex prompt"
- publish `expo-live-lens-client` as a real package
- publish a CLI such as `npx expo-live-lens setup` and `npx expo-live-lens review`
- Android ADB helpers for screenshots, taps, and screen recording
- replay timeline for "what changed before this bug"
- redaction hooks for sensitive logs or network payloads

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).

Near-term priorities:

1. AST-based setup for `App.tsx` and Expo Router layouts
2. richer route context and automatic Expo Router integration
3. package and CLI publishing flow
4. dashboard polish for logs, network, errors, and review workflows
5. better summary and review prompting for AI-assisted edits

## Privacy And Security

The dashboard is local, but it binds to `0.0.0.0` so physical phones can reach
it over LAN. Use it only on trusted networks. Do not expose it to the public
internet.

Screenshots and logs can contain sensitive data. See [SECURITY.md](SECURITY.md)
for the current policy and recommended use.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
