#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/ACE-Step-1.5"
SETTINGS="$ROOT/data/settings.json"

if [ ! -d "$VENDOR" ]; then
  echo "ACE-Step is not installed. Complete Setup in the studio UI, or run: npm run setup:engine" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/" >&2
  exit 1
fi

mkdir -p "$ROOT/data/jobs" "$ROOT/data/songs"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
export PYTHONUNBUFFERED=1
export TOKENIZERS_PARALLELISM=false
export HF_HUB_ENABLE_HF_TRANSFER=0
export HF_HUB_DISABLE_TELEMETRY=1

# Prefer data/settings.json (studio UI). Env vars still win when already set.
if [ -f "$SETTINGS" ] && command -v python3 >/dev/null 2>&1; then
  eval "$(
    python3 - <<'PY'
import json, os, shlex
from pathlib import Path
root = Path(os.environ.get("ROOT") or ".")
# ROOT not in env — infer from settings path via argv-less cwd; script sets ROOT before eval via export below
PY
  )" 2>/dev/null || true
fi

# Apply settings file without requiring jq
if [ -f "$SETTINGS" ]; then
  DIT="$(python3 -c "import json; d=json.load(open('$SETTINGS')); print(d.get('ditModel') or '')" 2>/dev/null || true)"
  LM="$(python3 -c "import json; d=json.load(open('$SETTINGS')); print(d.get('lmModel') or '')" 2>/dev/null || true)"
  BACKEND="$(python3 -c "import json; d=json.load(open('$SETTINGS')); print(d.get('backend') or '')" 2>/dev/null || true)"
  DEVICE="$(python3 -c "import json; d=json.load(open('$SETTINGS')); print(d.get('device') or '')" 2>/dev/null || true)"
  SAVE="$(python3 -c "import json; d=json.load(open('$SETTINGS')); print('1' if d.get('saveMemory', True) else '0')" 2>/dev/null || true)"
  if [ -n "${DIT:-}" ] && [ -z "${ACESTEP_CONFIG_PATH:-}" ]; then
    export ACESTEP_CONFIG_PATH="$DIT"
  fi
  if [ -n "${LM:-}" ] && [ -z "${ACESTEP_LM_MODEL_PATH:-}" ]; then
    export ACESTEP_LM_MODEL_PATH="$LM"
  fi
  if [ "${BACKEND:-}" = "mlx" ] || [ "${BACKEND:-}" = "pt" ]; then
    if [ -z "${ACESTEP_LM_BACKEND:-}" ]; then
      export ACESTEP_LM_BACKEND="$BACKEND"
    fi
  fi
  if [ "${DEVICE:-}" = "mps" ] || [ "${DEVICE:-}" = "cuda" ] || [ "${DEVICE:-}" = "cpu" ]; then
    if [ -z "${ACESTEP_DEVICE:-}" ]; then
      export ACESTEP_DEVICE="$DEVICE"
    fi
  fi
  if [ -n "${SAVE:-}" ] && [ -z "${ACESTEP_SAVE_MEMORY:-}" ]; then
    export ACESTEP_SAVE_MEMORY="$SAVE"
  fi
fi

# Fallbacks only when neither settings nor env set values
export ACESTEP_CONFIG_PATH="${ACESTEP_CONFIG_PATH:-acestep-v15-turbo}"
if [ "$(uname -s)" = "Darwin" ]; then
  export ACESTEP_LM_BACKEND="${ACESTEP_LM_BACKEND:-mlx}"
else
  export ACESTEP_LM_BACKEND="${ACESTEP_LM_BACKEND:-pt}"
fi
# Do not force 0.6B — worker/settings choose based on RAM when unset
export ACESTEP_SAVE_MEMORY="${ACESTEP_SAVE_MEMORY:-1}"

echo "[musicai] Starting local ACE-Step engine (loads model into RAM)..."
echo "[musicai] config=${ACESTEP_CONFIG_PATH} lm=${ACESTEP_LM_MODEL_PATH:-auto} backend=${ACESTEP_LM_BACKEND}"
echo "[musicai] If weights are missing, files download one-by-one with a progress bar."
echo "[musicai] Ctrl+C is safe — the next start resumes."

# Never stack multiple workers (each holds tens of GB). Kill leftovers first.
bash "$ROOT/scripts/kill-engine.sh" || true

cd "$VENDOR"
exec uv run python "$ROOT/engine/worker.py"
