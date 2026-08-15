#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/ACE-Step-1.5"
FILE="Qwen3-Embedding-0.6B/model.safetensors"
DEST="$VENDOR/checkpoints/$FILE"

if [ ! -d "$VENDOR" ]; then
  echo "ACE-Step is not installed. Run: npm run setup:engine" >&2
  exit 1
fi

export PYTHONUNBUFFERED=1
export HF_HUB_ENABLE_HF_TRANSFER=0

echo "[musicai] Repairing text encoder weights (common cause of 'invalid JSON in header')..."
rm -f "$DEST"
find "$VENDOR/checkpoints/.cache" -name "*Qwen3*" -name "*.incomplete" -delete 2>/dev/null || true
find "$VENDOR/checkpoints/.cache" -name "*Qwen3*" -name "*.lock" -delete 2>/dev/null || true

cd "$VENDOR"
exec uv run python - <<'PY'
import struct
from pathlib import Path
from huggingface_hub import hf_hub_download

filename = "Qwen3-Embedding-0.6B/model.safetensors"
print(f"[musicai] downloading {filename} ...")
path = Path(hf_hub_download(
    repo_id="ACE-Step/Ace-Step1.5",
    filename=filename,
    local_dir="checkpoints",
))
size = path.stat().st_size
print(f"[musicai] size={size / (1024**2):.1f} MB")
with path.open("rb") as f:
    header_len = struct.unpack("<Q", f.read(8))[0]
    start = f.read(1)
if header_len < 8 or start != b"{":
    raise SystemExit("Download still looks corrupt — re-run this script.")
print("[musicai] Text encoder weights OK. Now run: npm run engine")
PY
