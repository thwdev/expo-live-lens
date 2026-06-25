import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targetArg = process.argv[2];
const entryCandidates = [
  {
    path: "App.tsx",
    importPath: "./src/dev/live-lens",
    screenName: "App"
  },
  {
    path: "App.jsx",
    importPath: "./src/dev/live-lens",
    screenName: "App"
  },
  {
    path: "App.js",
    importPath: "./src/dev/live-lens",
    screenName: "App"
  },
  {
    path: join("app", "_layout.tsx"),
    importPath: "../src/dev/live-lens",
    screenName: "Root"
  },
  {
    path: join("app", "_layout.jsx"),
    importPath: "../src/dev/live-lens",
    screenName: "Root"
  },
  {
    path: join("app", "_layout.js"),
    importPath: "../src/dev/live-lens",
    screenName: "Root"
  }
];

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

function indentBlock(text, indent) {
  return text
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function findMatchingParen(source, openIndex) {
  let depth = 0;
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === "\\") {
        index += 1;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function getDefaultExportSearchStart(source) {
  const namedDefaultFunction = /export\s+default\s+function\s+[A-Za-z0-9_]+\s*\(/.exec(source);
  if (namedDefaultFunction) {
    return namedDefaultFunction.index;
  }

  const anonymousDefaultFunction = /export\s+default\s+function\s*\(/.exec(source);
  if (anonymousDefaultFunction) {
    return anonymousDefaultFunction.index;
  }

  const defaultExportName = /export\s+default\s+([A-Za-z0-9_]+)\s*;/.exec(source);
  if (!defaultExportName) {
    return 0;
  }

  const componentName = defaultExportName[1];
  const functionDeclaration = new RegExp(`function\\s+${componentName}\\s*\\(`).exec(source);
  if (functionDeclaration) {
    return functionDeclaration.index;
  }

  const variableDeclaration = new RegExp(`(?:const|let|var)\\s+${componentName}\\s*=`).exec(source);
  if (variableDeclaration) {
    return variableDeclaration.index;
  }

  return defaultExportName.index;
}

function injectImport(source, importPath) {
  if (source.includes("LiveLensRoot")) {
    return source;
  }

  const importLine = `import { LiveLensRoot } from "${importPath}";`;
  const matches = [...source.matchAll(/^import .*;$/gm)];

  if (matches.length === 0) {
    return `${importLine}\n${source}`;
  }

  const lastImport = matches[matches.length - 1];
  const insertAt = lastImport.index + lastImport[0].length;
  return `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
}

function wrapReturnWithLiveLens(source, options) {
  if (source.includes("<LiveLensRoot")) {
    return {
      changed: false,
      source,
      reason: "LiveLensRoot already present"
    };
  }

  const searchStart = getDefaultExportSearchStart(source);
  const returnMatch = /return\s*\(/g;
  returnMatch.lastIndex = searchStart;
  const foundReturn = returnMatch.exec(source);

  if (!foundReturn) {
    return {
      changed: false,
      source,
      reason: "No supported return(...) block found in default export"
    };
  }

  const returnIndex = foundReturn.index;
  const openParenIndex = source.indexOf("(", returnIndex);
  const closeParenIndex = findMatchingParen(source, openParenIndex);

  if (openParenIndex === -1 || closeParenIndex === -1) {
    return {
      changed: false,
      source,
      reason: "Could not safely match the return(...) block"
    };
  }

  const lineStart = source.lastIndexOf("\n", returnIndex) + 1;
  const returnIndent = source.slice(lineStart, returnIndex).match(/^\s*/)?.[0] || "";
  const childIndent = `${returnIndent}    `;
  const wrapperIndent = `${returnIndent}  `;
  const innerExpression = source.slice(openParenIndex + 1, closeParenIndex).trim();
  const wrappedReturn = [
    `${returnIndent}return (`,
    `${wrapperIndent}<LiveLensRoot`,
    `${wrapperIndent}  serverUrl={process.env.EXPO_PUBLIC_LIVE_LENS_URL || "http://${options.lanIp}:4317"}`,
    `${wrapperIndent}  screenName="${options.screenName}"`,
    `${wrapperIndent}  route="/"`,
    `${wrapperIndent}  captureMode="manual"`,
    `${wrapperIndent}  screenshotQuality={0.58}`,
    `${wrapperIndent}  captureNetwork`,
    `${wrapperIndent}>`,
    indentBlock(innerExpression, childIndent),
    `${wrapperIndent}</LiveLensRoot>`,
    `${returnIndent});`
  ].join("\n");

  const semicolonOffset = source[closeParenIndex + 1] === ";" ? 1 : 0;

  return {
    changed: true,
    source: `${source.slice(0, returnIndex)}${wrappedReturn}${source.slice(closeParenIndex + 1 + semicolonOffset)}`,
    reason: null
  };
}

function autoWrapEntrypoint(targetDir, candidate, lanIp) {
  const filePath = join(targetDir, candidate.path);
  if (!existsSync(filePath)) {
    return null;
  }

  const original = readFileSync(filePath, "utf8");
  const withImport = injectImport(original, candidate.importPath);
  const wrapped = wrapReturnWithLiveLens(withImport, {
    screenName: candidate.screenName,
    lanIp
  });

  if (!wrapped.changed) {
    return {
      filePath,
      backupPath: null,
      changed: false,
      reason: wrapped.reason
    };
  }

  const backupPath = `${filePath}.expo-live-lens.bak`;
  writeFileSync(backupPath, original);
  writeFileSync(filePath, wrapped.source);

  return {
    filePath,
    backupPath,
    changed: true,
    reason: null
  };
}

function writeSetupNotes(targetDir, lanIp, wrapResult) {
  const snippetPath = join(targetDir, "LIVE_LENS_SETUP.md");
  const entryMessage = wrapResult?.changed
    ? [
        "4. Your entry file was auto-wrapped.",
        "",
        `- Updated: \`${wrapResult.filePath}\``,
        `- Backup: \`${wrapResult.backupPath}\``
      ].join("\n")
    : [
        "4. Auto-wrap status.",
        "",
        wrapResult
          ? `- No automatic wrapper inserted: ${wrapResult.reason}`
          : "- No supported App.tsx or app/_layout.tsx file was found automatically.",
        "- Use the wrapper snippet below if you want to wire it in manually."
      ].join("\n");

  const snippet = `# Expo Live Lens Setup

1. Install the screenshot dependency:

\`\`\`bash
npx expo install react-native-view-shot
\`\`\`

2. Start the Live Lens dashboard from this repo:

\`\`\`bash
npm.cmd run dev
\`\`\`

3. Set your phone-facing server URL:

\`\`\`bash
$env:EXPO_PUBLIC_LIVE_LENS_URL="http://${lanIp}:4317"
\`\`\`

${entryMessage}

## Manual wrapper snippet

For App.tsx:

\`\`\`tsx
import { LiveLensRoot } from "./src/dev/live-lens";

export default function App() {
  return (
    <LiveLensRoot
      serverUrl={process.env.EXPO_PUBLIC_LIVE_LENS_URL || "http://${lanIp}:4317"}
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
\`\`\`

For Expo Router app/_layout.tsx:

\`\`\`tsx
import { Stack } from "expo-router";
import { LiveLensRoot } from "../src/dev/live-lens";

export default function RootLayout() {
  return (
    <LiveLensRoot
      serverUrl={process.env.EXPO_PUBLIC_LIVE_LENS_URL || "http://${lanIp}:4317"}
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
\`\`\`

Open the dashboard at http://localhost:4317 on the computer.
Use http://${lanIp}:4317 from phones on the same network.
`;

  writeFileSync(snippetPath, snippet);
  return snippetPath;
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
let wrapResult = null;
for (const candidate of entryCandidates) {
  const result = autoWrapEntrypoint(targetDir, candidate, lanIp);
  if (result) {
    wrapResult = result;
    break;
  }
}
const snippetPath = writeSetupNotes(targetDir, lanIp, wrapResult);

console.log("Expo Live Lens client copied:");
console.log(`  ${clientTarget}`);
console.log("");
console.log("Setup notes written:");
console.log(`  ${snippetPath}`);
console.log("");
console.log(`Detected LAN server URL: http://${lanIp}:4317`);

if (wrapResult?.changed) {
  console.log("");
  console.log("Entry file auto-wrapped:");
  console.log(`  ${wrapResult.filePath}`);
  console.log(`  Backup: ${wrapResult.backupPath}`);
} else if (wrapResult) {
  console.log("");
  console.log("Auto-wrap skipped:");
  console.log(`  ${wrapResult.reason}`);
} else {
  console.log("");
  console.log("Auto-wrap skipped:");
  console.log("  No supported App.tsx or app/_layout.tsx entry file was found.");
}
