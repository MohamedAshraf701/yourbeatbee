#!/usr/bin/env python3
"""CLI: separate → RVC convert → remix. Runs in vendor/rvc-env (Python 3.11)."""

from __future__ import annotations

import argparse
import gc
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def release_memory() -> None:
    gc.collect()
    try:
        import torch

        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            torch.mps.empty_cache()
    except Exception:
        pass


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or "")[-1200:]
        raise SystemExit(f"Command failed: {' '.join(cmd[:4])}…\n{tail}")


def separate(mix: Path, work: Path) -> tuple[Path, Path]:
    out_root = work / "demucs"
    out_root.mkdir(parents=True, exist_ok=True)
    device = "cpu"
    try:
        import torch

        if torch.backends.mps.is_available():
            device = "mps"
        elif torch.cuda.is_available():
            device = "cuda"
    except Exception:
        pass
    print(f"[musicai-rvc] Demucs device={device}", flush=True)
    run(
        [
            sys.executable,
            "-m",
            "demucs",
            "-n",
            "htdemucs",
            "-o",
            str(out_root),
            "--device",
            device,
            "--two-stems",
            "vocals",
            str(mix),
        ]
    )
    tracks = list((out_root / "htdemucs").glob("*"))
    if not tracks:
        raise SystemExit("Demucs produced no stems")
    stem = tracks[0]
    vocals, no_vocals = stem / "vocals.wav", stem / "no_vocals.wav"
    if not vocals.is_file() or not no_vocals.is_file():
        raise SystemExit(f"Missing stems in {stem}")
    return vocals, no_vocals


def convert(
    vocals: Path,
    out: Path,
    model: Path,
    index: Path | None,
    index_rate: float,
    assets: Path,
) -> None:
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

    # rvc-python downloads base models into package/base_model; seed from our cache.
    try:
        import rvc_python

        base = Path(rvc_python.__file__).resolve().parent / "base_model"
        base.mkdir(parents=True, exist_ok=True)
        for name in ("hubert_base.pt", "rmvpe.pt"):
            src = assets / name
            dst = base / name
            if src.is_file() and not dst.is_file():
                import shutil as _shutil

                _shutil.copy2(src, dst)
    except Exception as exc:
        print(f"[musicai-rvc] warning: could not seed base models: {exc}", flush=True)

    from rvc_python.infer import RVCInference

    device = "cpu"
    try:
        import torch

        if torch.backends.mps.is_available():
            device = "mps"
        elif torch.cuda.is_available():
            device = "cuda:0"
    except Exception:
        pass

    # rvc-python expects models_dir/<name>/*.pth
    model_name = model.parent.name
    models_dir = model.parent.parent
    print(f"[musicai-rvc] RVC device={device} model={model_name} index_rate={index_rate}", flush=True)
    rvc = RVCInference(device=device, models_dir=str(models_dir))
    rvc.load_model(model_name)
    try:
        rvc.set_params(index_rate=index_rate if index and index.is_file() else 0.0, f0method="rmvpe")
    except Exception:
        pass

    out.parent.mkdir(parents=True, exist_ok=True)
    # Prefer package API that uses loaded model + optional index from folder
    index_file = None
    if index and index.is_file():
        index_file = str(index)
    elif model.parent.joinpath("model.index").is_file():
        index_file = str(model.parent / "model.index")

    # infer_file uses current model; some versions accept file_index via set_params only
    if index_file:
        try:
            rvc.models[model_name]["index"] = index_file
        except Exception:
            pass

    rvc.infer_file(str(vocals), str(out))
    if not out.is_file():
        raise SystemExit("RVC wrote no output")
    try:
        rvc.unload_model()
    except Exception:
        pass
    release_memory()


def remix(vocals: Path, instrumental: Path, dest: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg required for My Voice remix")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix.lower() == ".mp3":
        run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(vocals),
                "-i",
                str(instrumental),
                "-filter_complex",
                "amix=inputs=2:duration=longest:normalize=0,volume=1.2",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                str(dest),
            ]
        )
    else:
        run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(vocals),
                "-i",
                str(instrumental),
                "-filter_complex",
                "amix=inputs=2:duration=longest:normalize=0,volume=1.2",
                str(dest),
            ]
        )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--mix", required=True, type=Path)
    p.add_argument("--model", required=True, type=Path)
    p.add_argument("--index", type=Path, default=None)
    p.add_argument("--strength", type=int, default=75)
    p.add_argument("--assets", type=Path, required=True)
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()

    if not args.mix.is_file():
        raise SystemExit(f"mix missing: {args.mix}")
    if not args.model.is_file():
        raise SystemExit(f"model missing: {args.model}")

    strength = max(0, min(100, args.strength))
    index_rate = round(0.3 + (strength / 100.0) * 0.6, 2)

    with tempfile.TemporaryDirectory(prefix="musicai-rvc-") as tmp:
        work = Path(tmp)
        vocals, no_vocals = separate(args.mix, work)
        release_memory()
        converted = work / "converted.wav"
        convert(vocals, converted, args.model, args.index, index_rate, args.assets)
        release_memory()
        remixed = work / f"out{args.out.suffix or '.wav'}"
        remix(converted, no_vocals, remixed)
        shutil.copy2(remixed, args.out)

    print(f"[musicai-rvc] wrote {args.out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
