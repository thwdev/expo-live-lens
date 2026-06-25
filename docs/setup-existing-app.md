# Add Expo Live Lens To An Existing App

Use the setup helper from this repository root:

```bash
npm run setup:app -- C:\path\to\your\expo-app
```

The helper:

- checks that the target has an Expo dependency
- copies the Live Lens client to `src/dev/live-lens.tsx`
- writes `LIVE_LENS_SETUP.md` into the target app with a ready-to-paste wrapper snippet
- detects a likely LAN IP for physical-device testing

Then install the screenshot dependency in the target Expo app:

```bash
npx expo install react-native-view-shot
```

Wrap your app root with `LiveLensRoot`. For phones, use the LAN URL shown by the setup helper instead of `localhost`.

## Why Copy The Client?

For this early MVP, copying avoids package publishing and Metro monorepo configuration. Later we can publish `expo-live-lens-client` as an npm package and replace this with:

```bash
npx expo install expo-live-lens-client react-native-view-shot
```
