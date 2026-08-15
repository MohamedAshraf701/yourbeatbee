#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/ACE-Step-1.5"

if [ ! -d "$VENDOR" ]; then
  echo "ACE-Step is not installed. Run: npm run setup:engine" >&2
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
export ACESTEP_CONFIG_PATH="${ACESTEP_CONFIG_PATH:-acestep-v15-turbo}"
export ACESTEP_LM_BACKEND="${ACESTEP_LM_BACKEND:-mlx}"
export ACESTEP_LM_MODEL_PATH="${ACESTEP_LM_MODEL_PATH:-acestep-5Hz-lm-0.6B}"
export ACESTEP_SAVE_MEMORY="${ACESTEP_SAVE_MEMORY:-1}"

echo "[musicai] Starting local ACE-Step engine (loads model into RAM)..."
echo "[musicai] If weights are missing, files download one-by-one with a progress bar."
echo "[musicai] Ctrl+C is safe — the next start resumes."

cd "$VENDOR"
exec uv run python "$ROOT/engine/worker.py"
