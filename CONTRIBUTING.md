# Contributing

Thanks for helping improve Expo Live Lens.

## Local Setup

```bash
npm install
npm.cmd run dev
```

In another terminal:

```bash
set EXPO_PUBLIC_LIVE_LENS_URL=http://YOUR_COMPUTER_IP:4317
npm.cmd run dev:demo:offline
```

## Checks

Run these before opening a pull request:

```bash
npm.cmd run check
npx.cmd tsc --noEmit --project examples/demo-expo/tsconfig.json
```

## Design Principles

- Expo Go first.
- No custom native build for the core workflow.
- Keep screenshots out of text payloads whenever possible.
- Prefer manual/event-based capture over constant streaming.
- Make the AI handoff explicit and inspectable.
- Keep sensitive data local by default.

## Pull Requests

Good pull requests usually include:

- a short problem statement
- screenshots or review-packet notes for UI changes
- clear testing notes
- docs updates for setup or behavior changes
