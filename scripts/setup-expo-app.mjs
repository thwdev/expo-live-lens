import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targetArg = process.argv[2];

function getLanIp() {
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const item of interfaces || []) {
      if (item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")) {
        return item.address;
      }
    }
  }

  return "YOUR_COMPUTER_IP";
}

function ensurePackageJson(targetDir) {
  const packagePath = join(targetDir, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error(`No package.json found in ${targetDir}. Run this inside or point to an Expo app folder.`);
  }

  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  if (!deps.expo) {
    throw new Error(`${targetDir} does not look like an Expo app because it has no expo dependency.`);
  }
}

if (!targetArg) {
  console.log("Usage:");
  console.log("  npm run setup:app -- C:\\path\\to\\expo-app");
  process.exit(1);
}

const targetDir = resolve(targetArg);
ensurePackageJson(targetDir);

const clientSource = join(rootDir, "packages", "expo-live-lens-client", "src", "index.tsx");
const clientTarget = join(targetDir, "src", "dev", "live-lens.tsx");
mkdirSync(dirname(clientTarget), { recursive: true });
copyFileSync(clientSource, clientTarget);

const lanIp = getLanIp();
const snippetPath = join(targetDir, "LIVE_LENS_SETUP.md");
const snippet = `# Expo Live Lens Setup

1. Install the screenshot dependency:

\`\`\`bash
npx expo install react-native-view-shot
\`\`\`

2. Start the Live Lens dashboard from this repo:

\`\`\`bash
npm.cmd run dev
\`\`\`

3. Wrap your app root.

For App.tsx:

\`\`\`tsx
import { LiveLensRoot } from "./src/dev/live-lens";

export default function App() {
  return (
    <LiveLensRoot
      serverUrl="http://${lanIp}:4317"
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
\`\`\`

For Expo Router app/_layout.tsx:

\`\`\`tsx
import { Stack } from "expo-router";
import { LiveLensRoot } from "../src/dev/live-lens";

export default function RootLayout() {
  return (
    <LiveLensRoot
      serverUrl="http://${lanIp}:4317"
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
\`\`\`

Open the dashboard at http://localhost:4317 on the computer.
Use http://${lanIp}:4317 from phones on the same network.
`;

writeFileSync(snippetPath, snippet);

console.log("Expo Live Lens client copied:");
console.log(`  ${clientTarget}`);
console.log("");
console.log("Setup notes written:");
console.log(`  ${snippetPath}`);
console.log("");
console.log(`Detected LAN server URL: http://${lanIp}:4317`);
