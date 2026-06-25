# Expo Live Lens Setup

1. Install the screenshot dependency:

```bash
npx expo install react-native-view-shot
```

2. Start the Live Lens dashboard from this repo:

```bash
npm.cmd run dev
```

3. Set your phone-facing server URL:

```bash
$env:EXPO_PUBLIC_LIVE_LENS_URL="http://YOUR_COMPUTER_IP:4317"
```

4. Auto-wrap status.

- No automatic wrapper inserted: LiveLensRoot already present
- Use the wrapper snippet below if you want to wire it in manually.

## Manual wrapper snippet

For App.tsx:

```tsx
import { LiveLensRoot } from "./src/dev/live-lens";

export default function App() {
  return (
    <LiveLensRoot
      serverUrl={process.env.EXPO_PUBLIC_LIVE_LENS_URL || "http://YOUR_COMPUTER_IP:4317"}
      screenName="App"
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

For Expo Router app/_layout.tsx:

```tsx
import { Stack } from "expo-router";
import { LiveLensRoot } from "../src/dev/live-lens";

export default function RootLayout() {
  return (
    <LiveLensRoot
      serverUrl={process.env.EXPO_PUBLIC_LIVE_LENS_URL || "http://YOUR_COMPUTER_IP:4317"}
      screenName="Root"
      route="/"
      captureMode="manual"
      screenshotQuality={0.58}
      captureNetwork
    >
      <Stack />
    </LiveLensRoot>
  );
}
```

Open the dashboard at http://localhost:4317 on the computer.
Use http://YOUR_COMPUTER_IP:4317 from phones on the same network.
