# Feature Matrix

This matrix translates Radon-like features into what we can realistically build
for a free Expo Live Lens workflow.

| Feature | MVP Feasibility | Best Route | Notes |
| --- | --- | --- | --- |
| Element inspector | Partial | React Native refs, testID metadata, optional Expo DevTools plugin | Full click-to-source mapping is hard without deeper tooling. |
| Debugging and logging | Yes | Console patching, global error handlers, dashboard stream | Works in Expo Go. |
| Dev tools | Yes | Local dashboard and Expo DevTools plugin later | Start with browser dashboard. |
| Isolated components preview | Later | Web/Expo preview harness or Storybook-lite | Possible, but not first MVP. |
| Basic device emulator | No | Use Android Emulator/iOS Simulator directly | Building an emulator is out of scope. |
| Basic device settings | Partial | ADB for Android, simulator tooling for iOS/macOS | Expo Go alone cannot control OS settings. |
| Connect mode | Yes | Local server URL, QR/deep link helper later | Works over LAN/tunnel. |
| Expo Router integration | Partial | Route events now work, deeper auto-detection still to do | Basic route context exists; richer router helpers can improve it. |
| Network inspector | Yes | Patch fetch/XMLHttpRequest in dev | Works for JS network requests. Native module traffic is limited. |
| Screenshots | Yes | react-native-view-shot or ADB screencap | Expo Go supports view screenshots with dependency installed. |
| Screen recording | Android yes, iOS limited | ADB screenrecord, simulator tooling | Physical iOS on Windows is the hardest case. |
| Replays | Partial | Timeline, screenshots, and recorded sessions | Current sessions are in-memory and can export a review packet/prompt. |
| Extended device emulator | No | Existing emulators | Not worth rebuilding. |
| Advanced device settings | Partial | ADB/simulator commands | Platform-specific. |
| Storybook integration | Later | Storybook adapter | Useful after isolated previews. |
| Maestro testing integration | Later | Generate/run Maestro flows | Needs Maestro installed. |
| AI assistant | Yes | Local summary, mobile insights, review packet, and prompt API using screenshots/logs | Requires model/provider integration. |
| Early access features | N/A | Project roadmap | Not relevant for an open local tool. |
| Priority support | N/A | GitHub issues/docs | Not a product support layer. |

## Recommended MVP

1. Live dashboard
2. Console, error, and custom event stream
3. Screenshot capture from app root
4. Route/state event API
5. Manual "AI review packet" export
6. Copy-ready review prompts and duplicate screenshot suppression
7. Mobile coach insights: issues, quality gates, timeline, and next actions
8. Dashboard event search and replay timeline
9. Screenshot history with before/after comparison
10. Recorded sessions for reviewing complete flows

## Main Constraints

- Expo Go cannot load arbitrary native modules.
- iOS physical-device automation from Windows is very limited.
- Android physical devices and emulators are much easier through ADB.
- Full element-to-source inspection needs build tooling or React DevTools data.
