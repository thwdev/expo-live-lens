#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dashboard}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$ROOT_DIR/examples/demo-expo"

show_usage() {
  cat <<'USAGE'
usage: ./script/build_and_run.sh [mode]

Modes:
  dashboard, start, run   Start the Expo Live Lens dashboard
  --demo, demo            Start the demo Expo app
  --demo-offline          Start the demo Expo app in offline mode
  --review-ui             Pull a UI review prompt
  --review-bug            Pull a bug-triage review prompt
  --review-polish         Pull a polish review prompt
  --review-mobile         Pull a senior mobile-dev review prompt
  --mobile-insights       Pull prioritized mobile-development insights
  --timeline              Pull the replay timeline
  --capture-now           Request a screenshot capture from the connected app
  --session-start         Start a recorded mobile session
  --session-stop          Stop the active recorded mobile session
  --session-pull          Pull the latest session packet and review prompt
  --review-now            Request a fresh screenshot and pull the review packet
  --health                Print dashboard health
  --help, help            Show this help
USAGE
}

resolve_npm_cmd() {
  if command -v npm.cmd >/dev/null 2>&1; then
    NPM_CMD=(npm.cmd)
  else
    NPM_CMD=(npm)
  fi
}

detect_lan_ip() {
  node -e "const os=require('os'); for (const list of Object.values(os.networkInterfaces())) { for (const item of list || []) { if (item && item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.')) { console.log(item.address); process.exit(0); } } } console.log('YOUR_COMPUTER_IP');"
}

run_dashboard() {
  cd "$ROOT_DIR"
  exec node src/server.mjs
}

run_demo() {
  local start_script="${1:-start}"
  local lan_ip
  lan_ip="$(detect_lan_ip)"

  cd "$ROOT_DIR"
  export EXPO_PUBLIC_LIVE_LENS_URL="http://${lan_ip}:4317"
  echo "Expo demo target: ${EXPO_PUBLIC_LIVE_LENS_URL}"
  exec "${NPM_CMD[@]}" --prefix "$DEMO_DIR" run "$start_script"
}

run_review_prompt() {
  local mode="${1:?mode required}"
  cd "$ROOT_DIR"
  exec node scripts/pull-review-prompt.mjs "$mode"
}

run_health() {
  cd "$ROOT_DIR"
  exec node -e "const url='http://localhost:4317/api/health'; fetch(url).then(async (response) => { const text = await response.text(); if (!response.ok) { console.error(text); process.exit(1); } console.log(text); }).catch((error) => { console.error(error.message); process.exit(1); });"
}

resolve_npm_cmd

case "$MODE" in
  dashboard|start|run)
    run_dashboard
    ;;
  --demo|demo)
    run_demo "start"
    ;;
  --demo-offline|demo-offline)
    run_demo "start:offline"
    ;;
  --review-ui|review-ui)
    run_review_prompt "ui"
    ;;
  --review-bug|review-bug)
    run_review_prompt "bug"
    ;;
  --review-polish|review-polish)
    run_review_prompt "polish"
    ;;
  --review-mobile|review-mobile)
    run_review_prompt "mobile"
    ;;
  --mobile-insights|mobile-insights)
    cd "$ROOT_DIR"
    exec node scripts/pull-mobile-insights.mjs
    ;;
  --timeline|timeline)
    cd "$ROOT_DIR"
    exec node scripts/pull-timeline.mjs
    ;;
  --capture-now|capture-now)
    cd "$ROOT_DIR"
    exec node scripts/request-capture.mjs "codex-action"
    ;;
  --session-start|session-start)
    cd "$ROOT_DIR"
    exec node scripts/session.mjs start
    ;;
  --session-stop|session-stop)
    cd "$ROOT_DIR"
    exec node scripts/session.mjs stop
    ;;
  --session-pull|session-pull)
    cd "$ROOT_DIR"
    exec node scripts/session.mjs pull
    ;;
  --review-now|review-now)
    cd "$ROOT_DIR"
    exec node scripts/pull-review-packet.mjs --now
    ;;
  --health|health)
    run_health
    ;;
  --help|help)
    show_usage
    ;;
  *)
    show_usage >&2
    exit 2
    ;;
esac
