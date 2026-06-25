# Roadmap

Expo Live Lens is useful now as a proof-of-loop: Expo Go sends screen state to a
local dashboard, and an AI coding agent can pull a compact review packet, inspect
the screenshot, and edit code.

## Milestone 1: GitHub-Ready MVP

- Clean README and setup docs
- MIT license
- Security and contributing docs
- Issue templates
- Manual screenshot capture
- Small review packet with screenshot file endpoint
- Tiny summary endpoint for low-token AI context
- Dashboard event tabs for logs, network, errors, screenshots, and app state
- Demo app on Expo SDK 54

## Milestone 2: Frictionless Setup

- Add project-local Codex run actions for dashboard, demo, and review flows
- Improve `setup:app` to cover more entrypoint patterns beyond the current heuristic auto-wrap
- Add safer AST-based wrapper insertion
- Print LAN URL and firewall hints
- Add Windows, macOS, and Linux setup notes
- Add uninstall command

## Milestone 3: Better AI Context

- Expand `/api/summary` with richer route, performance, and interaction context
- Use `/api/mobile-insights` as the main AI planning layer for issues, quality gates, and next actions
- Expand `/api/timeline` and screenshot history into named replay sessions
- Add retention controls for persisted recorded sessions
- Add route context helper for Expo Router
- Add network event filtering and redaction
- Add console log levels and search
- Add replay-aware prompts and source-file hints

## Milestone 4: Developer Experience

- Publish `expo-live-lens-client` package
- Add CLI binary: `npx expo-live-lens`
- Add command: `npx expo-live-lens setup`
- Add command: `npx expo-live-lens review`
- Add basic test suite

## Milestone 5: Advanced Device Workflows

- Android ADB screenshot fallback
- Android tap automation
- Screen recording helper
- Maestro flow export
- Replay timeline

## Non-Goals For Now

- Rebuilding a full emulator
- Replacing React Native DevTools
- Native iOS physical-device automation on Windows
- Sending screenshots to third-party cloud services by default
