"""HeartMuLa generation runner for MusicAI studio jobs."""

from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
HEART_VENDOR = ROOT / "vendor" / "heartlib"
DEFAULT_CKPT = HEART_VENDOR / "ckpt"

_STOP = {
    "a",
    "an",
    "the",
    "with",
    "and",
    "of",
    "for",
    "to",
    "in",
    "on",
    "about",
    "from",
    "into",
    "over",
    "under",
    "very",
    "more",
    "most",
    "song",
    "music",
    "track",
}


def style_to_tags(style: str) -> str:
    """Map studio style prose → HeartMuLa comma tags (no spaces)."""
    text = (style or "").lower().strip()
    if not text:
        return "pop,ballad"

    tags: list[str] = []

    def add_token(token: str) -> None:
        token = re.sub(r"[^a-z0-9\-]", "", token)
        if token and token not in tags and token not in _STOP and len(token) >= 2:
            tags.append(token)

    def add_words(fragment: str) -> None:
        for w in re.findall(r"[a-z0-9\-]+", fragment):
            add_token(w)

    if re.search(r"[,;]", text):
        for part in re.split(r"[,;\n]+", text):
            part = part.strip()
            if not part:
                continue
            # Short phrase → single tag; long prose fragment → words
            if " " in part and len(part) > 28:
                add_words(part)
            else:
                add_token(re.sub(r"\s+", "", part))
    else:
        add_words(text)

    return ",".join(tags[:24]) or "pop,ballad"


def resolve_ckpt(settings: dict[str, Any]) -> Path:
    env = (settings.get("heartmulaCkpt") or "").strip()
    if env:
        return Path(env).expanduser()

    if os.environ.get("HEARTMULA_CKPT"):
        return Path(os.environ["HEARTMULA_CKPT"]).expanduser()
    return DEFAULT_CKPT


def _mps_available() -> bool:
    import torch

    return bool(
        getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()
    )


def patch_transformers_mps_warmup() -> None:
    """Skip transformers' single huge MPS `torch.empty` (fails with Invalid buffer size).

    CUDA/XPU paths cap the warmup allocation; MPS does not, so ~3B fp16 tries to
    reserve ~15GiB in one Metal buffer and crashes. Weights still load without warmup.
    """
    import torch
    import transformers.modeling_utils as modeling_utils

    if getattr(modeling_utils, "_musicai_mps_warmup_patched", False):
        return

    original = modeling_utils.caching_allocator_warmup

    def caching_allocator_warmup(model, expanded_device_map, hf_quantizer=None):
        try:
            devices = {
                torch.device(dev)
                for dev in (expanded_device_map or {}).values()
                if modeling_utils.is_accelerator_device(dev)
            }
        except Exception:
            devices = set()
        if any(d.type == "mps" for d in devices):
            print(
                "[musicai] Skipping transformers MPS allocator warmup "
                "(avoids Invalid buffer size ~15GiB)."
            )
            return None
        return original(model, expanded_device_map, hf_quantizer)

    modeling_utils.caching_allocator_warmup = caching_allocator_warmup
    modeling_utils._musicai_mps_warmup_patched = True


def save_audio_tensor(wav_tensor: Any, save_path: Path, sample_rate: int = 48000) -> Path:
    """Write audio without torchcodec (torchaudio 2.9+ default backend on Mac)."""
    import torch

    audio = wav_tensor.detach().to(dtype=torch.float32).cpu()
    if audio.ndim == 1:
        audio = audio.unsqueeze(0)

    save_path = Path(save_path)
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # Prefer WAV via soundfile; convert to MP3 with ffmpeg when requested.
    wav_path = (
        save_path
        if save_path.suffix.lower() == ".wav"
        else save_path.with_suffix(".wav")
    )

    try:
        import soundfile as sf

        arr = audio.numpy()
        if arr.ndim == 2:
            arr = arr.T
        sf.write(str(wav_path), arr, sample_rate)
    except Exception:
        try:
            import torchaudio

            torchaudio.save(str(wav_path), audio, sample_rate, backend="soundfile")
        except Exception as exc:
            raise RuntimeError(
                "Could not save HeartMuLa audio (need soundfile). "
                f"Original error: {exc}"
            ) from exc

    if save_path.suffix.lower() == ".mp3":
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg:
            import subprocess

            result = subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    str(wav_path),
                    "-codec:a",
                    "libmp3lame",
                    "-qscale:a",
                    "2",
                    str(save_path),
                ],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0 and save_path.is_file():
                try:
                    wav_path.unlink(missing_ok=True)
                except Exception:
                    pass
                return save_path
            print(
                "[musicai] ffmpeg MP3 convert failed; keeping WAV. "
                f"{(result.stderr or '')[-200:]}"
            )
        return wav_path

    return wav_path


def patch_pipeline_audio_save(pipe: Any) -> None:
    """Replace heartlib postprocess so saving does not require torchcodec."""

    def postprocess(model_outputs: dict, save_path: str) -> None:
        frames = model_outputs["frames"].to(pipe.codec_device)
        wav = pipe.codec.detokenize(frames)
        pipe._unload()
        dest = save_audio_tensor(wav, Path(save_path), 48000)
        requested = Path(save_path)
        if dest.resolve() != requested.resolve() and dest.is_file():
            if requested.suffix.lower() == ".mp3":
                print(f"[musicai] Saved {dest.name} (install ffmpeg for MP3).")
            else:
                shutil.copy2(dest, requested)

    pipe.postprocess = postprocess


def patch_pipeline_mps_unload(pipe: Any) -> None:
    """heartlib._unload assumes CUDA; replace with MPS-safe teardown when needed."""
    import gc

    import torch

    if getattr(pipe, "mula_device", None) is None:
        return
    if pipe.mula_device.type != "mps" and pipe.codec_device.type != "mps":
        return

    def _unload() -> None:
        if not pipe.lazy_load:
            return
        if pipe._mula is not None:
            print("[musicai] Unloading HeartMuLa from MPS.")
            del pipe._mula
            pipe._mula = None
        if pipe._codec is not None:
            print("[musicai] Unloading HeartCodec from MPS.")
            del pipe._codec
            pipe._codec = None
        gc.collect()
        try:
            torch.mps.empty_cache()
        except Exception:
            pass

    pipe._unload = _unload


def patch_heartcodec_mps_timestep_dtype() -> None:
    """Fix heartlib `.type(timesteps.type())` — invalid on MPS (`torch.mps.FloatTensor`)."""
    import math

    import torch
    from heartlib.heartcodec.models.transformer import (
        PixArtAlphaCombinedFlowEmbeddings,
    )

    if getattr(PixArtAlphaCombinedFlowEmbeddings, "_musicai_mps_type_fixed", False):
        return

    def timestep_embedding(self, timesteps, max_period=10000, scale=1000):
        half = self.flow_t_size // 2
        freqs = torch.exp(
            -math.log(max_period)
            * torch.arange(start=0, end=half, device=timesteps.device)
            / half
        ).to(dtype=timesteps.dtype)
        args = timesteps[:, None] * freqs[None] * scale
        embedding = torch.cat([torch.cos(args), torch.sin(args)], dim=-1)
        if self.flow_t_size % 2:
            embedding = torch.cat(
                [embedding, torch.zeros_like(embedding[:, :1])], dim=-1
            )
        return embedding

    PixArtAlphaCombinedFlowEmbeddings.timestep_embedding = timestep_embedding
    PixArtAlphaCombinedFlowEmbeddings._musicai_mps_type_fixed = True
    print("[musicai] Patched HeartCodec timestep embedding for MPS dtype.")


def prepare_mps_runtime() -> None:
    """Env tweaks that help large models on Apple Silicon."""
    # 0.0 disables the high-watermark cap that can OOM mid-load.
    os.environ.setdefault("PYTORCH_MPS_HIGH_WATERMARK_RATIO", "0.0")
    patch_transformers_mps_warmup()
    patch_heartcodec_mps_timestep_dtype()


def pick_device(settings: dict[str, Any]) -> str:
    """Prefer CUDA, then MPS, then CPU."""
    import torch

    pref = (settings.get("device") or "auto").lower()
    if pref == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError(
                "Device is set to CUDA but no CUDA GPU is available. "
                "Set device to MPS or CPU, or use ACE-Step."
            )
        return "cuda"
    if pref == "mps":
        if not _mps_available():
            raise RuntimeError("Device is set to MPS but MPS is not available.")
        return "mps"
    if pref == "cpu":
        print(
            "[musicai] WARNING: HeartMuLa on CPU is extremely slow and memory-heavy."
        )
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    if _mps_available():
        print(
            "[musicai] HeartMuLa on Apple MPS (experimental). Prefer ≥24GB unified "
            "memory; enable lazy-load; close other heavy apps."
        )
        return "mps"
    print(
        "[musicai] WARNING: No CUDA/MPS — HeartMuLa will use CPU (impractical for most machines)."
    )
    return "cpu"


def mula_dtype_for_device(device_name: str):
    import torch

    if device_name == "cuda":
        return torch.bfloat16
    if device_name == "mps":
        # float16 fits Metal better than fp32; bf16 support on MPS is uneven.
        return torch.float16
    return torch.float32


def influence_to_cfg(influence: int) -> float:
    value = max(0, min(100, int(influence)))
    return round(1.0 + (value / 100.0) * 1.5, 2)


def weirdness_to_temperature(weirdness: int) -> float:
    value = max(0, min(100, int(weirdness)))
    return round(0.7 + (value / 100.0) * 0.8, 2)


def duration_to_ms(duration: float, *, device_name: str = "cuda") -> int:
    """Map studio duration (seconds) → HeartMuLa max_audio_length_ms.

    HeartMuLa runs one generate_frame per 80ms of audio (e.g. 240s ⇒ 3000 steps).
    On MPS that is slow but intentional when the user asks for a full song.
    """
    del device_name  # reserved for logging/callers; do not cap length by device
    if duration is None or float(duration) <= 0:
        return 240_000
    return int(max(15_000, min(600_000, float(duration) * 1000)))


ProgressCb = Callable[..., None]


def run_heartmula_job(
    job: dict[str, Any],
    *,
    settings: dict[str, Any],
    songs_dir: Path,
    work_dir: Path,
    update_progress: ProgressCb,
) -> dict[str, Any]:
    """Generate one song with HeartMuLa. Returns song metadata dict + audio path."""
    import torch
    from heartlib import HeartMuLaGenPipeline

    from compose import normalize_lyrics_for_model

    job_id = job["id"]
    ckpt = resolve_ckpt(settings)
    if not ckpt.is_dir():
        raise RuntimeError(
            f"HeartMuLa checkpoint dir missing: {ckpt}. Run bash scripts/download-heartmula.sh"
        )

    lyrics = normalize_lyrics_for_model((job.get("lyrics") or "").strip())
    if not lyrics:
        lyrics = "[Verse]\nLa la la\n[Chorus]\nOh oh oh"
    tags = style_to_tags(job.get("style") or "")
    version = str(settings.get("heartmulaVersion") or "3B")
    lazy = bool(settings.get("heartmulaLazyLoad", True))
    device_name = pick_device(settings)
    device = torch.device(device_name)

    if device_name == "mps":
        prepare_mps_runtime()
        # Lazy load is effectively required on unified-memory Macs.
        if not lazy:
            print("[musicai] Forcing lazy_load=True on MPS to reduce peak memory.")
            lazy = True

    work_dir.mkdir(parents=True, exist_ok=True)
    lyrics_path = work_dir / f"{job_id}.lyrics.txt"
    tags_path = work_dir / f"{job_id}.tags.txt"
    lyrics_path.write_text(lyrics, encoding="utf-8")
    tags_path.write_text(tags, encoding="utf-8")

    out_path = songs_dir / f"{job_id}.mp3"
    max_ms = duration_to_ms(float(job.get("duration") or -1), device_name=device_name)
    if device_name == "mps":
        frames = max_ms // 80
        print(
            f"[musicai] HeartMuLa on MPS: up to {max_ms / 1000:.0f}s "
            f"({frames} frames). Full songs are slow on Apple Silicon — expect a long wait."
        )
    cfg = influence_to_cfg(int(job.get("influence", 50)))
    temperature = weirdness_to_temperature(int(job.get("weirdness", 30)))
    mula_dtype = mula_dtype_for_device(device_name)

    update_progress(
        phase="loading",
        progress=12,
        message=f"Loading HeartMuLa {version} on {device_name}…",
    )
    print(
        f"[musicai] {job_id}: HeartMuLa tags={tags!r} device={device_name} "
        f"dtype={mula_dtype} lazy={lazy} max_ms={max_ms}"
    )

    try:
        pipe = HeartMuLaGenPipeline.from_pretrained(
            str(ckpt),
            device={"mula": device, "codec": device},
            dtype={
                "mula": mula_dtype,
                "codec": torch.float32,
            },
            version=version,
            lazy_load=lazy,
        )
        patch_pipeline_audio_save(pipe)
        if device_name == "mps":
            patch_pipeline_mps_unload(pipe)

        update_progress(
            phase="generating",
            progress=30,
            message="Generating with HeartMuLa — this can take several minutes…",
        )
        with torch.no_grad():
            pipe(
                {
                    "lyrics": str(lyrics_path),
                    "tags": str(tags_path),
                },
                max_audio_length_ms=max_ms,
                save_path=str(out_path),
                topk=50,
                temperature=temperature,
                cfg_scale=cfg,
            )
    except RuntimeError as exc:
        msg = str(exc)
        if "Invalid buffer size" in msg:
            raise RuntimeError(
                "HeartMuLa still hit an MPS buffer limit while loading. "
                "Try: close other apps, ensure lazy-load is on, prefer ≥24GB RAM, "
                "or switch back to ACE-Step. Original error: "
                + msg
            ) from exc
        raise

    wav_fallback = out_path.with_suffix(".wav")
    if out_path.is_file():
        pass
    elif wav_fallback.is_file():
        out_path = wav_fallback
    else:
        raise RuntimeError(f"HeartMuLa did not write {out_path.name} or {wav_fallback.name}")

    # Ensure file lives under songs_dir with expected name
    if out_path.parent != songs_dir:
        dest = songs_dir / out_path.name
        shutil.move(str(out_path), str(dest))
        out_path = dest

    update_progress(phase="saving", progress=85, message="Saving audio…")

    return {
        "lyrics": lyrics,
        "tags": tags,
        "caption": job.get("style") or tags,
        "audio_path": out_path,
        "model": f"HeartMuLa-oss-{version}",
        "device": device_name,
    }
