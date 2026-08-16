#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACE_VENDOR="$ROOT/vendor/ACE-Step-1.5"
HEART_VENDOR="$ROOT/vendor/heartlib"
SETTINGS="$ROOT/data/settings.json"

mkdir -p "$ROOT/data/jobs" "$ROOT/data/songs"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
export PYTHONUNBUFFERED=1
export TOKENIZERS_PARALLELISM=false
export HF_HUB_ENABLE_HF_TRANSFER=0
export HF_HUB_DISABLE_TELEMETRY=1

FAMILY="ace"
if [ -f "$SETTINGS" ] && command -v python3 >/dev/null 2>&1; then
  FAMILY="$(
    python3 -c "import json; print(json.load(open('$SETTINGS')).get('engineFamily') or 'ace')" 2>/dev/null || echo ace
  )"
fi
FAMILY="$(echo "$FAMILY" | tr '[:upper:]' '[:lower:]')"

# Never stack multiple workers (each holds tens of GB). Kill leftovers first.
bash "$ROOT/scripts/kill-engine.sh" || true

  if [ "$FAMILY" = "heartmula" ]; then
  if [ ! -d "$HEART_VENDOR" ]; then
    echo "HeartMuLa is not installed. Complete Setup in the studio UI, or run: bash scripts/setup-heartmula.sh" >&2
    exit 1
  fi
  if [ ! -x "$HEART_VENDOR/.venv/bin/python" ]; then
    echo "HeartMuLa venv missing. Run: bash scripts/setup-heartmula.sh" >&2
    exit 1
  fi
  if [ ! -d "$HEART_VENDOR/ckpt/HeartMuLa-oss-3B" ] || [ ! -d "$HEART_VENDOR/ckpt/HeartCodec-oss" ]; then
    echo "HeartMuLa weights missing. Run: bash scripts/download-heartmula.sh" >&2
    exit 1
  fi
  echo "[musicai] Starting HeartMuLa engine (loads 3B + codec into memory)…"
  echo "[musicai] ckpt=$HEART_VENDOR/ckpt"
  echo "[musicai] Ctrl+C unloads the engine."
  export MUSICAI_ENGINE_FAMILY=heartmula
  export HEARTMULA_CKPT="$HEART_VENDOR/ckpt"
  # Allow large MPS allocations (HeartMuLa 3B); runner also skips transformers warmup.
  export PYTORCH_MPS_HIGH_WATERMARK_RATIO="${PYTORCH_MPS_HIGH_WATERMARK_RATIO:-0.0}"
  export PYTHONPATH="$ROOT/engine:${HEART_VENDOR}:${PYTHONPATH:-}"
  cd "$HEART_VENDOR"
  exec "$HEART_VENDOR/.venv/bin/python" "$ROOT/engine/worker.py"
fi

# ——— ACE-Step path ———
if [ ! -d "$ACE_VENDOR" ]; then
  echo "ACE-Step is not installed. Complete Setup in the studio UI, or run: npm run setup:engine" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/" >&2
  exit 1
fi

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

export ACESTEP_CONFIG_PATH="${ACESTEP_CONFIG_PATH:-acestep-v15-turbo}"
if [ "$(uname -s)" = "Darwin" ]; then
  export ACESTEP_LM_BACKEND="${ACESTEP_LM_BACKEND:-mlx}"
else
  export ACESTEP_LM_BACKEND="${ACESTEP_LM_BACKEND:-pt}"
fi
export ACESTEP_SAVE_MEMORY="${ACESTEP_SAVE_MEMORY:-1}"
export MUSICAI_ENGINE_FAMILY=ace

echo "[musicai] Starting local ACE-Step engine (loads model into RAM)..."
echo "[musicai] config=${ACESTEP_CONFIG_PATH} lm=${ACESTEP_LM_MODEL_PATH:-auto} backend=${ACESTEP_LM_BACKEND}"
echo "[musicai] If weights are missing, files download one-by-one with a progress bar."
echo "[musicai] Ctrl+C is safe — the next start resumes."

cd "$ACE_VENDOR"
exec uv run python "$ROOT/engine/worker.py"
