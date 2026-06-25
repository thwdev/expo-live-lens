# Expo Live Lens Setup

1. Install the screenshot dependency:

```bash
npx expo install react-native-view-shot
```

2. Start the Live Lens dashboard from this repo:

```bash
npm.cmd run dev
```

3. Wrap your app root.

For App.tsx:

```tsx
import { LiveLensRoot } from "./src/dev/live-lens";

export default function App() {
  return (
    <LiveLensRoot
      serverUrl="http://YOUR_COMPUTER_IP:4317"
      screenName="App"
      route="/"
      captureMode="manual"
      captureIntervalMs={2500}
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
      serverUrl="http://YOUR_COMPUTER_IP:4317"
      screenName="Root"
      route="/"
      captureMode="manual"
      captureIntervalMs={2500}
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
