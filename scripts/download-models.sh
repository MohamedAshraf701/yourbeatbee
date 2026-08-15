#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/ACE-Step-1.5"

if [ ! -d "$VENDOR" ]; then
  echo "ACE-Step is not installed. Run: npm run setup:engine" >&2
  exit 1
fi

export PYTHONUNBUFFERED=1
export HF_HUB_ENABLE_HF_TRANSFER=0
export HF_HUB_DISABLE_TELEMETRY=1

cd "$VENDOR"
exec uv run python -c "import os, sys; sys.path.insert(0, '$ROOT/engine'); from download import ensure_checkpoints, ensure_lm; from pathlib import Path; root = Path('$VENDOR/checkpoints'); ensure_checkpoints(root); ensure_lm(root, os.environ.get('ACESTEP_LM_MODEL_PATH', 'acestep-5Hz-lm-0.6B'))"
