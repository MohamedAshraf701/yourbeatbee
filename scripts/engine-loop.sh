#!/usr/bin/env bash
# Keep the engine process running under `npm run studio`.
# When the UI stops the worker (Apply & restart / crash), this loop
# respawns it. A hold file keeps the engine stopped until Start.
# Ctrl+C / SIGTERM must exit the loop — do not respawn forever.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOLD="$ROOT/data/engine-hold"
MARKER="$ROOT/data/studio-managed"
STOPPING=0
CHILD_PID=""

mkdir -p "$ROOT/data"
# Signal to the Next.js supervisor that studio owns the engine slot.
echo $$ >"$MARKER"

cleanup_marker() {
  rm -f "$MARKER"
}

request_stop() {
  STOPPING=1
  if [ -n "${CHILD_PID:-}" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill -TERM "$CHILD_PID" 2>/dev/null || true
  fi
  cleanup_marker
  # Kill any leftover worker so RAM is freed even if child already exited.
  bash "$ROOT/scripts/kill-engine.sh" >/dev/null 2>&1 || true
  exit 0
}

trap cleanup_marker EXIT
trap request_stop INT TERM HUP

# Fresh studio session should not inherit a previous Stop.
rm -f "$HOLD"

while [ "$STOPPING" -eq 0 ]; do
  if [ -f "$HOLD" ]; then
    echo "[musicai] Engine held stopped. Use Start in Engine settings to resume."
    while [ -f "$HOLD" ] && [ "$STOPPING" -eq 0 ]; do
      sleep 1
    done
    [ "$STOPPING" -ne 0 ] && break
    echo "[musicai] Hold cleared — starting engine…"
  fi

  bash "$ROOT/scripts/start-engine.sh" &
  CHILD_PID=$!
  wait "$CHILD_PID" || true
  CHILD_PID=""

  [ "$STOPPING" -ne 0 ] && break

  if [ -f "$HOLD" ]; then
    continue
  fi

  echo "[musicai] Engine exited; restarting in 2s…"
  sleep 2 || true
done

cleanup_marker
