#!/usr/bin/env bash
# Download HeartMuLa 3B + HeartCodec checkpoints into vendor/heartlib/ckpt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/heartlib"
CKPT="$VENDOR/ckpt"

if [ ! -d "$VENDOR" ]; then
  echo "HeartMuLa is not installed. Run: bash scripts/setup-heartmula.sh" >&2
  exit 1
fi

mkdir -p "$CKPT"

if ! command -v hf >/dev/null 2>&1 && ! command -v huggingface-cli >/dev/null 2>&1; then
  echo "[musicai] Installing huggingface_hub CLI into HeartMuLa venv..."
  if [ -x "$VENDOR/.venv/bin/pip" ]; then
    "$VENDOR/.venv/bin/pip" install -U "huggingface_hub[cli]"
  else
    python3 -m pip install -U "huggingface_hub[cli]"
  fi
fi

HF_BIN=""
if [ -x "$VENDOR/.venv/bin/hf" ]; then
  HF_BIN="$VENDOR/.venv/bin/hf"
elif command -v hf >/dev/null 2>&1; then
  HF_BIN="hf"
elif command -v huggingface-cli >/dev/null 2>&1; then
  HF_BIN="huggingface-cli"
fi

if [ -z "$HF_BIN" ]; then
  echo "Could not find hf / huggingface-cli. Install huggingface_hub." >&2
  exit 1
fi

download() {
  local repo="$1"
  local dest="$2"
  echo "[musicai] Downloading $repo → $dest"
  mkdir -p "$dest"
  if [ "$(basename "$HF_BIN")" = "huggingface-cli" ]; then
    "$HF_BIN" download "$repo" --local-dir "$dest"
  else
    "$HF_BIN" download --local-dir "$dest" "$repo"
  fi
}

# Tokenizer + gen config
download "HeartMuLa/HeartMuLaGen" "$CKPT"
# Music LM weights
download "HeartMuLa/HeartMuLa-oss-3B-happy-new-year" "$CKPT/HeartMuLa-oss-3B"
# Codec
download "HeartMuLa/HeartCodec-oss-20260123" "$CKPT/HeartCodec-oss"

echo
echo "HeartMuLa weights ready under $CKPT"
echo "Expected layout:"
echo "  ckpt/HeartCodec-oss/"
echo "  ckpt/HeartMuLa-oss-3B/"
echo "  ckpt/gen_config.json"
echo "  ckpt/tokenizer.json"
