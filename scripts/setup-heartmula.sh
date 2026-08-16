#!/usr/bin/env bash
# Clone HeartMuLa/heartlib and create an isolated Python 3.10 venv.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/heartlib"
REPO="https://github.com/HeartMuLa/heartlib.git"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to clone HeartMuLa." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

mkdir -p "$ROOT/vendor" "$ROOT/data/jobs" "$ROOT/data/songs"

if [ ! -d "$VENDOR/.git" ]; then
  echo "[musicai] Cloning HeartMuLa heartlib into vendor/heartlib"
  git clone --depth 1 "$REPO" "$VENDOR"
else
  echo "[musicai] HeartMuLa already cloned. Pulling latest main..."
  git -C "$VENDOR" pull --ff-only || true
fi

VENV="$VENDOR/.venv"
USE_UV=0
if command -v uv >/dev/null 2>&1; then
  USE_UV=1
fi

# uv venv has no pip by default; recreate if python exists but pip is missing
need_venv=0
if [ ! -x "$VENV/bin/python" ]; then
  need_venv=1
elif [ "$USE_UV" -eq 0 ] && ! "$VENV/bin/python" -m pip --version >/dev/null 2>&1; then
  need_venv=1
fi

if [ "$need_venv" -eq 1 ]; then
  echo "[musicai] Creating HeartMuLa venv (Python 3.10 preferred)..."
  rm -rf "$VENV"
  if [ "$USE_UV" -eq 1 ]; then
    uv venv --python 3.10 "$VENV" 2>/dev/null || uv venv "$VENV"
  else
    python3 -m venv "$VENV"
  fi
fi

# Apple MPS: heartlib uses .type(tensor.type()) which raises
# ValueError: invalid type: 'torch.mps.FloatTensor'
PATCH_FILE="$VENDOR/src/heartlib/heartcodec/models/transformer.py"
if [ -f "$PATCH_FILE" ] && grep -q '\.type(timesteps\.type())' "$PATCH_FILE"; then
  echo "[musicai] Patching HeartCodec timestep embedding for MPS…"
  python3 - <<PY
from pathlib import Path
p = Path(r"$PATCH_FILE")
text = p.read_text(encoding="utf-8")
old = ").type(timesteps.type())"
new = ").to(dtype=timesteps.dtype)"
if old in text:
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("patched", p)
PY
fi

echo "[musicai] Installing heartlib into venv..."
if [ "$USE_UV" -eq 1 ]; then
  uv pip install --python "$VENV/bin/python" -U pip wheel
  uv pip install --python "$VENV/bin/python" -e "$VENDOR"
else
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  if ! python -m pip --version >/dev/null 2>&1; then
    python -m ensurepip --upgrade
  fi
  python -m pip install -U pip wheel
  (
    cd "$VENDOR"
    python -m pip install -e .
  )
fi

echo
echo "HeartMuLa code installed. Next download weights:"
echo "  bash scripts/download-heartmula.sh"
echo "Or use the studio Engine / Setup UI."
