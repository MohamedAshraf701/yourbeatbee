#!/usr/bin/env bash
# Install Demucs + rvc-python in an isolated Python 3.10 venv.
# (fairseq / rvc-python break on Python 3.11+ dataclasses.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RVC_ROOT="$ROOT/vendor/rvc-env"
RVC_ASSETS="$ROOT/data/models/rvc"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install from https://docs.astral.sh/uv/" >&2
  exit 1
fi

mkdir -p "$RVC_ROOT" "$RVC_ASSETS" "$ROOT/data/voices/rvc"

echo "[musicai] Creating Python 3.10 venv for My Voice (RVC) at vendor/rvc-env…"
cd "$RVC_ROOT"

cat > "$RVC_ROOT/pyproject.toml" <<'EOF'
[project]
name = "musicai-rvc"
version = "0.1.0"
requires-python = ">=3.10,<3.11"
dependencies = [
  "demucs",
  "rvc-python",
  "numpy>=1.24,<1.26",
  "torch==2.2.2",
  "torchaudio==2.2.2",
  "soundfile",
  "setuptools>=69,<81",
]

[tool.uv]
package = false
EOF

uv python install 3.10 >/dev/null 2>&1 || true
# Recreate venv when switching Python minor versions
if [ -d .venv ]; then
  PYVER="$(.venv/bin/python -c 'import sys; print("%d.%d"%sys.version_info[:2])' 2>/dev/null || true)"
  if [ "$PYVER" != "3.10" ]; then
    echo "[musicai] Replacing existing .venv (was Python $PYVER) with 3.10…"
    rm -rf .venv
  fi
fi
uv sync --python 3.10

download_asset() {
  local url="$1"
  local dest="$2"
  if [ -f "$dest" ]; then
    echo "[musicai] Already have $(basename "$dest")"
    return 0
  fi
  echo "[musicai] Downloading $(basename "$dest")…"
  curl -L --fail --retry 3 -o "$dest.partial" "$url"
  mv "$dest.partial" "$dest"
}

echo "[musicai] Fetching RVC HuBERT / RMVPE weights…"
download_asset \
  "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/hubert_base.pt" \
  "$RVC_ASSETS/hubert_base.pt" || true
download_asset \
  "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.pt" \
  "$RVC_ASSETS/rmvpe.pt" || true

# Seed into the package path rvc-python checks on first load
BASE_MODEL="$(uv run --directory "$RVC_ROOT" python -c 'import rvc_python, os; print(os.path.join(os.path.dirname(rvc_python.__file__), "base_model"))' 2>/dev/null || true)"
if [ -n "$BASE_MODEL" ]; then
  mkdir -p "$BASE_MODEL"
  for f in hubert_base.pt rmvpe.pt; do
    if [ -f "$RVC_ASSETS/$f" ] && [ ! -f "$BASE_MODEL/$f" ]; then
      cp "$RVC_ASSETS/$f" "$BASE_MODEL/$f"
      echo "[musicai] Seeded $f into rvc-python base_model/"
    fi
  done
fi

echo "[musicai] RVC env ready: $RVC_ROOT"
echo "  Smoke test: uv run --directory vendor/rvc-env python -c 'from rvc_python.infer import RVCInference'"
