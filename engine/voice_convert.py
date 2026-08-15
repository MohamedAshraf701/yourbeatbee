"""Invoke isolated RVC env to convert song vocals (My Voice)."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
RVC_ENV = ROOT / "vendor" / "rvc-env"
RVC_ASSETS = ROOT / "data" / "models" / "rvc"
RVC_CLI = Path(__file__).resolve().parent / "rvc_cli.py"


def rvc_python() -> Path:
    """Return the uv-managed Python for the RVC venv, or raise a clear error."""
    # Prefer uv run so deps resolve from pyproject
    if shutil.which("uv") and (RVC_ENV / "pyproject.toml").is_file():
        return Path("uv")  # sentinel — caller uses uv run
    venv_py = RVC_ENV / ".venv" / "bin" / "python"
    if venv_py.is_file():
        return venv_py
    raise RuntimeError(
        "My Voice RVC env is not set up. Run: npm run setup:rvc  (or npm run setup:engine)"
    )


def apply_rvc_to_song(
    mix_path: Path,
    model_path: Path,
    index_path: Optional[Path],
    voice_strength: int,
) -> Path:
    """Run Demucs + RVC + remix in a subprocess (does not load into ACE-Step process)."""
    if not model_path.is_file():
        raise FileNotFoundError(f"RVC model missing: {model_path}")
    if not RVC_CLI.is_file():
        raise FileNotFoundError(f"Missing {RVC_CLI}")

    out_path = mix_path  # overwrite in place
    strength = max(0, min(100, int(voice_strength)))
    cmd: list[str]
    py = rvc_python()
    if py.name == "uv":
        cmd = [
            "uv",
            "run",
            "--directory",
            str(RVC_ENV),
            "python",
            str(RVC_CLI),
        ]
    else:
        cmd = [str(py), str(RVC_CLI)]

    cmd += [
        "--mix",
        str(mix_path),
        "--model",
        str(model_path),
        "--strength",
        str(strength),
        "--assets",
        str(RVC_ASSETS),
        "--out",
        str(out_path),
    ]
    if index_path and index_path.is_file():
        cmd += ["--index", str(index_path)]

    env = os.environ.copy()
    env.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

    print(f"[musicai] My Voice: spawning RVC pipeline…")
    result = subprocess.run(cmd, env=env, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            "My Voice RVC conversion failed. "
            "Ensure npm run setup:rvc completed and ffmpeg is installed."
        )
    if not out_path.is_file():
        raise RuntimeError("RVC pipeline did not update the song file")
    print(f"[musicai] My Voice RVC remix wrote {out_path}")
    return out_path
