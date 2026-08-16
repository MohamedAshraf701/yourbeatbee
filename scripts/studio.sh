#!/usr/bin/env bash
# UI + engine together. Always unloads the engine when this script exits
# (Ctrl+C, terminal close, or process death) so RAM does not stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  # Idempotent — safe if engine already stopped.
  bash "$ROOT/scripts/kill-engine.sh" || true
}
trap cleanup EXIT INT TERM HUP

# Drop orphans from earlier studio runs before loading another copy into RAM.
bash "$ROOT/scripts/kill-engine.sh" || true

echo "[musicai] Starting studio (web + engine). Ctrl+C unloads the engine."
# Do not use --kill-others: Apply & restart / Stop in the UI kill the
# engine worker on purpose; that must not tear down the Next.js process.
# engine-loop respawns the worker so terminal logs keep flowing.
npx concurrently \
  -n web,engine \
  -c cyan,magenta \
  "npm run dev" \
  "bash scripts/engine-loop.sh"
