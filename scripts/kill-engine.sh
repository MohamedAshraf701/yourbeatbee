#!/usr/bin/env bash
# Stop every MusicAI ACE-Step worker so model RAM is released.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$ROOT/data/engine.pid"
ENGINE_JSON="$ROOT/data/engine.json"

kill_pid() {
  local pid="$1"
  if [ -z "$pid" ]; then
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

if [ -f "$PIDFILE" ]; then
  OLD_PID="$(tr -d '[:space:]' <"$PIDFILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ]; then
    echo "[musicai] Stopping engine pid $OLD_PID…"
    kill_pid "$OLD_PID"
  fi
fi

# Heartbeat may point at a live worker even if pidfile is stale.
if [ -f "$ENGINE_JSON" ] && command -v python3 >/dev/null 2>&1; then
  HB_PID="$(
    python3 -c "import json; print(json.load(open('$ENGINE_JSON')).get('pid') or '')" 2>/dev/null || true
  )"
  if [ -n "${HB_PID:-}" ]; then
    kill_pid "$HB_PID"
  fi
fi

# Catch orphans from npm run studio / uv / concurrent restarts.
pkill -TERM -f '[e]ngine/worker.py' 2>/dev/null || true

# Give MPS/Python a moment to tear down, then force-kill leftovers.
sleep 1
pkill -KILL -f '[e]ngine/worker.py' 2>/dev/null || true

rm -f "$PIDFILE"

if command -v python3 >/dev/null 2>&1; then
  python3 - <<PY
import json
from pathlib import Path
from datetime import datetime, timezone

root = Path("$ROOT")
now = datetime.now(timezone.utc).isoformat()
for name, payload in [
    ("data/engine.json", {
        "updatedAt": now,
        "pid": None,
        "ready": False,
        "busy": False,
        "alive": False,
        "phase": "stopped",
        "progress": 0,
        "message": "Engine stopped.",
        "error": None,
    }),
    ("data/engine-supervisor.json", {
        "pid": None,
        "startedAt": None,
        "status": "stopped",
        "error": None,
    }),
]:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
fi

echo "[musicai] Engine unloaded."
