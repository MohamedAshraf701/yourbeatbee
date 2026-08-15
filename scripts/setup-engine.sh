#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/ACE-Step-1.5"
REPO="https://github.com/ACE-Step/ACE-Step-1.5.git"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to clone ACE-Step." >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/" >&2
  echo "  curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  exit 1
fi

mkdir -p "$ROOT/vendor" "$ROOT/data/jobs" "$ROOT/data/songs"

if [ ! -d "$VENDOR/.git" ]; then
  echo "[musicai] Cloning ACE-Step 1.5 into vendor/ACE-Step-1.5"
  git clone --depth 1 "$REPO" "$VENDOR"
else
  echo "[musicai] ACE-Step already cloned. Pulling latest main..."
  git -C "$VENDOR" pull --ff-only || true
fi

echo "[musicai] Installing Python dependencies with uv (Mac / MLX)..."
(
  cd "$VENDOR"
  uv sync
)

MEM_GB="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
if [ "$MEM_GB" -gt 0 ] 2>/dev/null; then
  MEM_GB=$((MEM_GB / 1024 / 1024 / 1024))
  echo "[musicai] Detected ~${MEM_GB}GB unified memory."
  if [ "$MEM_GB" -ge 24 ]; then
    echo "[musicai] Hint: engine will prefer acestep-5Hz-lm-1.7B"
  else
    echo "[musicai] Hint: engine will prefer acestep-5Hz-lm-0.6B"
  fi
fi

echo
echo "Setup complete. Weights download on first engine start and stay on this Mac."
echo "Next:"
echo "  npm run studio"
echo "  # or separately: npm run engine   and   npm run dev"
