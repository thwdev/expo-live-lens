# Expo Live Lens Demo App

This is a small Expo Go test app for Expo Live Lens.

It targets Expo SDK 54 so it can open in the iOS Expo Go app version that currently supports SDK 54.

## Install

From this folder:

```bash
npm install
```

## Run

Start the dashboard from the repository root:

```bash
npm.cmd run dev
```

Then start this demo app:

```bash
npm start
```

If Expo CLI fails with `fetch failed`, use the offline start command:

```bash
npm run start:offline
```

For a physical phone, set the dashboard URL to your computer's LAN IP:

```bash
$env:EXPO_PUBLIC_LIVE_LENS_URL="http://YOUR_COMPUTER_IP:4317"
npm start
```

Open the QR code in Expo Go. The dashboard at `http://localhost:4317` should show screenshots, logs, app-state, custom events, and network events.
