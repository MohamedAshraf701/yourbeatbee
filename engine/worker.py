#!/usr/bin/env python3
"""Load ACE-Step 1.5 into Mac memory and process local studio jobs."""

from __future__ import annotations

import gc
import json
import os
import shutil
import sys
import threading
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "ACE-Step-1.5"
DATA = ROOT / "data"
JOBS = DATA / "jobs"
SONGS = DATA / "songs"
ENGINE_FILE = DATA / "engine.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compose import (  # noqa: E402
    MPS_MAX_DURATION,
    clip_caption,
    clip_lyrics,
    compose_caption,
    job_to_params,
)
from download import ensure_checkpoints, ensure_lm  # noqa: E402


def ensure_reference_audio(path_str: str) -> str:
    """Require a readable reference file; convert WebM/Opus to WAV when needed."""
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"My Voice reference missing: {path}")

    if path.suffix.lower() in {".wav", ".flac"}:
        return str(path)

    wav_path = path.with_suffix(".wav")
    if wav_path.is_file() and wav_path.stat().st_mtime >= path.stat().st_mtime:
        return str(wav_path)

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print(
            f"[musicai] warning: ffmpeg not found — using {path.name} as-is "
            "(WAV is more reliable for My Voice)"
        )
        return str(path)

    import subprocess

    print(f"[musicai] converting voice reference {path.name} → {wav_path.name}")
    result = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(path),
            "-ac",
            "1",
            "-ar",
            "48000",
            str(wav_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not wav_path.is_file():
        raise RuntimeError(
            "Could not convert My Voice recording to WAV. "
            f"ffmpeg said: {(result.stderr or result.stdout or '')[-400:]}"
        )
    return str(wav_path)


_WRITE_LOCKS: dict[str, threading.Lock] = {}
_WRITE_LOCKS_GUARD = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _lock_for(path: Path) -> threading.Lock:
    key = str(path)
    with _WRITE_LOCKS_GUARD:
        lock = _WRITE_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _WRITE_LOCKS[key] = lock
        return lock


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp"
    try:
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        with _lock_for(path):
            os.replace(tmp, path)
    except OSError:
        tmp.unlink(missing_ok=True)
        raise
    tmp.unlink(missing_ok=True)


def read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def physical_memory_gb() -> float:
    try:
        pages = os.sysconf("SC_PHYS_PAGES")
        page = os.sysconf("SC_PAGE_SIZE")
        return (pages * page) / (1024**3)
    except (ValueError, OSError):
        return 16.0


def pick_device() -> str:
    env = os.environ.get("ACESTEP_DEVICE")
    if env:
        return env
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def pick_lm(mem_gb: float) -> str:
    env = os.environ.get("ACESTEP_LM_MODEL_PATH")
    if env:
        return env
    # 1.7B + turbo DiT OOMs the lyric encoder on ~24GB unified memory.
    return "acestep-5Hz-lm-1.7B" if mem_gb >= 32 else "acestep-5Hz-lm-0.6B"


def pick_backend() -> str:
    env = os.environ.get("ACESTEP_LM_BACKEND")
    if env:
        return env
    return "mlx" if sys.platform == "darwin" else "pt"


def tight_memory(device: str) -> bool:
    return device == "mps" and physical_memory_gb() < 32


def is_oom(message: object) -> bool:
    text = str(message or "").lower()
    return "out of memory" in text or "mps backend out of memory" in text


def release_unified_memory() -> None:
    try:
        import mlx.core as mx

        clear = getattr(mx, "clear_cache", None)
        if callable(clear):
            clear()
        metal = getattr(mx, "metal", None)
        if metal is not None:
            metal_clear = getattr(metal, "clear_cache", None)
            if callable(metal_clear):
                metal_clear()
    except Exception:
        pass
    gc.collect()
    try:
        import torch

        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            if hasattr(torch.mps, "synchronize"):
                torch.mps.synchronize()
            if hasattr(torch.mps, "empty_cache"):
                torch.mps.empty_cache()
    except Exception:
        pass


def ffmpeg_available() -> bool:
    if shutil.which("ffmpeg"):
        return True
    for extra in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        binary = Path(extra)
        if binary.is_file():
            os.environ["PATH"] = str(binary.parent) + os.pathsep + os.environ.get("PATH", "")
            return True
    return False


def pick_audio_format() -> str:
    return "mp3" if ffmpeg_available() else "wav"


def persist_song_audio(audio: dict, job_id: str, fmt: str) -> Path:
    dest = SONGS / f"{job_id}.{fmt}"
    src = Path(str(audio.get("path") or ""))
    if src.is_file() and src.stat().st_size > 0:
        if src.suffix:
            dest = SONGS / f"{job_id}{src.suffix.lower()}"
        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)
            if src.parent == SONGS and src.name != dest.name:
                try:
                    src.unlink()
                except OSError:
                    pass
        return dest

    tensor = audio.get("tensor")
    if tensor is None:
        raise RuntimeError(
            "generation produced no audio file. ffmpeg is required for MP3; "
            "restart npm run engine to save WAV instead."
        )
    dest = SONGS / f"{job_id}.wav"
    sample_rate = int(audio.get("sample_rate") or 48000)
    wav = tensor.detach().cpu()
    if wav.ndim == 1:
        wav = wav.unsqueeze(0)
    try:
        import torchaudio

        torchaudio.save(str(dest), wav, sample_rate, backend="soundfile")
    except Exception:
        import soundfile as sf

        arr = wav.numpy()
        if arr.ndim == 2:
            arr = arr.T
        sf.write(str(dest), arr, sample_rate)
    if not dest.is_file() or dest.stat().st_size == 0:
        raise RuntimeError("failed to write WAV audio")
    print(f"[musicai] {job_id}: wrote WAV (ffmpeg not installed)")
    return dest


def wrap_lm_to_release_memory(llm) -> None:
    if getattr(llm, "_musicai_memory_wrapped", False):
        return
    original = llm.generate_with_stop_condition

    def generate_then_release(*args, **kwargs):
        try:
            return original(*args, **kwargs)
        finally:
            release_unified_memory()

    llm.generate_with_stop_condition = generate_then_release
    llm._musicai_memory_wrapped = True


def pick_config() -> str:
    env = os.environ.get("ACESTEP_CONFIG_PATH")
    if env:
        return env
    # sft is a second multi-GB download and is tight on 12–16GB unified memory.
    return "acestep-v15-turbo"


def start_heartbeat_thread(**extra: object) -> threading.Event:
    stop = threading.Event()

    def loop() -> None:
        while not stop.wait(4):
            write_heartbeat(**extra)

    thread = threading.Thread(target=loop, daemon=True)
    thread.start()
    write_heartbeat(**extra)
    return stop


def write_heartbeat(**extra: object) -> None:
    payload = {
        "ready": False,
        "updatedAt": utc_now(),
        "pid": os.getpid(),
        **extra,
    }
    try:
        write_json(ENGINE_FILE, payload)
    except OSError as exc:
        print(f"[musicai] heartbeat write skipped: {exc}", file=sys.stderr)


def reset_stale_jobs() -> None:
    JOBS.mkdir(parents=True, exist_ok=True)
    for path in JOBS.glob("*.json"):
        job = read_json(path)
        if job and job.get("status") == "running":
            job["status"] = "queued"
            job["updatedAt"] = utc_now()
            write_json(path, job)


def next_queued_job() -> tuple[Path, dict] | None:
    files = sorted(JOBS.glob("*.json"), key=lambda p: p.stat().st_mtime)
    for path in files:
        job = read_json(path)
        if job and job.get("status") == "queued":
            return path, job
    return None


def assert_dit_ready(dit) -> None:
    missing = [
        name
        for name, value in (
            ("model", getattr(dit, "model", None)),
            ("vae", getattr(dit, "vae", None)),
            ("text_encoder", getattr(dit, "text_encoder", None)),
            ("text_tokenizer", getattr(dit, "text_tokenizer", None)),
        )
        if value is None
    ]
    if missing:
        raise RuntimeError(
            "DiT handler is not fully initialized (missing: "
            + ", ".join(missing)
            + "). Restart npm run engine and wait until it says Model loaded."
        )


def load_handlers():
    if not VENDOR.exists():
        raise FileNotFoundError(
            f"ACE-Step not found at {VENDOR}. Run scripts/setup-engine.sh first."
        )

    if str(VENDOR) not in sys.path:
        sys.path.insert(0, str(VENDOR))

    from acestep.handler import AceStepHandler
    from acestep.llm_inference import LLMHandler

    device = pick_device()
    mem_gb = physical_memory_gb()
    config_path = pick_config()
    lm_model = pick_lm(mem_gb)
    backend = pick_backend()
    checkpoint_dir = os.environ.get(
        "ACESTEP_CHECKPOINTS", str(VENDOR / "checkpoints")
    )
    Path(checkpoint_dir).mkdir(parents=True, exist_ok=True)

    pulse = start_heartbeat_thread(
        ready=False,
        device=device,
        model=config_path,
        lm=lm_model,
        error=None,
        message="Downloading ACE-Step weights onto this Mac. The file counter can pause for a long time on one large file — that is not a hang.",
    )
    print(f"[musicai] device={device} backend={backend} model={config_path} lm={lm_model} ram≈{mem_gb:.1f}GB")
    dit = None
    llm = None
    try:
        ensure_checkpoints(Path(checkpoint_dir))
        ensure_lm(Path(checkpoint_dir), lm_model)
        pulse.set()
        pulse = start_heartbeat_thread(
            ready=False,
            device=device,
            model=config_path,
            lm=lm_model,
            error=None,
            message="Loading ACE-Step 1.5 into memory on this Mac.",
        )
        print("[musicai] Loading DiT / VAE / text encoder into RAM...")

        dit = AceStepHandler()
        dit_msg, dit_ok = dit.initialize_service(
            project_root=str(VENDOR),
            config_path=config_path,
            device=device,
        )
        if not dit_ok:
            raise RuntimeError(f"DiT initialize_service failed: {dit_msg}")
        assert_dit_ready(dit)
        print(f"[musicai] DiT ready. {dit_msg.splitlines()[0] if dit_msg else ''}")

        print(f"[musicai] Loading LM ({lm_model}, backend={backend})...")
        llm = LLMHandler()
        llm_msg, llm_ok = llm.initialize(
            checkpoint_dir=checkpoint_dir,
            lm_model_path=lm_model,
            backend=backend,
            device=device,
        )
        if not llm_ok:
            # Retry once with PyTorch backend if MLX failed.
            if backend == "mlx":
                print(f"[musicai] MLX LM init failed ({llm_msg}); retrying with pt...")
                llm_msg, llm_ok = llm.initialize(
                    checkpoint_dir=checkpoint_dir,
                    lm_model_path=lm_model,
                    backend="pt",
                    device=device,
                )
            if not llm_ok:
                raise RuntimeError(f"LM initialize failed: {llm_msg}")
        if not getattr(llm, "llm_initialized", False):
            raise RuntimeError("LM reported success but llm_initialized is False.")
        print(f"[musicai] LM ready. {llm_msg.splitlines()[0] if llm_msg else ''}")
        wrap_lm_to_release_memory(llm)
    except Exception:
        write_heartbeat(
            ready=False,
            device=device,
            model=config_path,
            lm=lm_model,
            error="Model failed to load. See engine terminal logs.",
            message="Engine failed during model load.",
        )
        raise
    finally:
        pulse.set()

    write_heartbeat(
        ready=True,
        device=device,
        model=config_path,
        lm=lm_model,
        error=None,
        message="Model loaded on this Mac.",
    )
    print("[musicai] Model loaded. Watching data/jobs/")
    return dit, llm, device, config_path, lm_model


def build_generation_params(mapped: dict, caption: str, lyrics: str):
    from acestep.inference import GenerationParams

    return GenerationParams(
        task_type="text2music",
        caption=caption,
        lyrics=lyrics,
        instrumental=mapped["instrumental"],
        vocal_language=mapped["vocal_language"],
        bpm=mapped["bpm"],
        duration=mapped["duration"],
        seed=mapped["seed"],
        guidance_scale=mapped["guidance_scale"],
        lm_cfg_scale=mapped["lm_cfg_scale"],
        lm_temperature=mapped["lm_temperature"],
        infer_method=mapped["infer_method"],
        thinking=mapped["thinking"],
        use_cot_caption=mapped["use_cot_caption"],
        use_cot_language=mapped["use_cot_language"],
        use_cot_metas=mapped["use_cot_metas"],
        inference_steps=mapped["inference_steps"],
        reference_audio=mapped.get("reference_audio"),
        audio_cover_strength=float(mapped.get("audio_cover_strength") or 0.0),
    )


def run_job(dit, llm, path: Path, job: dict, device: str) -> None:
    from acestep.inference import (
        GenerationConfig,
        create_sample,
        generate_music,
    )

    job_id = job["id"]
    job["status"] = "running"
    job["updatedAt"] = utc_now()
    write_json(path, job)

    assert_dit_ready(dit)
    if not getattr(llm, "llm_initialized", False):
        raise RuntimeError(
            "LM is not initialized. Restart npm run engine and wait until it says Model loaded."
        )

    original_lyrics = (job.get("lyrics") or "").strip()
    original_duration = job.get("duration")
    job["tight_memory"] = tight_memory(device)
    mapped = job_to_params(job)
    lyrics = mapped["lyrics"]
    caption = mapped["caption"]

    if mapped.get("reference_audio"):
        mapped["reference_audio"] = ensure_reference_audio(mapped["reference_audio"])
        print(
            f"[musicai] {job_id}: My Voice reference OK → {mapped['reference_audio']} "
            f"(strength={mapped.get('audio_cover_strength')}, thinking={mapped.get('thinking')})"
        )

    if original_lyrics and len(original_lyrics) > len(lyrics):
        print(
            f"[musicai] {job_id}: clipped lyrics {len(original_lyrics)} → {len(lyrics)} chars "
            "to fit Apple Silicon memory"
        )
    if (
        job["tight_memory"]
        and original_duration not in (None, -1, 0, "auto", "", "30", 30)
        and float(original_duration) > MPS_MAX_DURATION
        and mapped["duration"] == MPS_MAX_DURATION
    ):
        print(
            f"[musicai] {job_id}: capped duration {original_duration} → {int(MPS_MAX_DURATION)}s "
            "(5 min max on this Mac)"
        )

    if mapped["needs_sample"]:
        print(f"[musicai] {job_id}: no lyrics — asking LM to draft a sample")
        sample = create_sample(
            llm,
            query=mapped["sample_query"],
            instrumental=mapped["instrumental"],
            vocal_language=mapped["vocal_language"],
            temperature=mapped["lm_temperature"],
        )
        if not sample.success:
            raise RuntimeError(sample.error or "create_sample failed")
        caption = clip_caption(
            compose_caption(sample.caption or mapped["sample_query"], job.get("voice") or "female")
        )
        lyrics = clip_lyrics(sample.lyrics or "", mapped["lyrics_limit"])
        if mapped["bpm"] is None and sample.bpm:
            mapped["bpm"] = sample.bpm
        if mapped["duration"] <= 0 and sample.duration:
            mapped["duration"] = float(sample.duration)
            if job["tight_memory"] and mapped["duration"] > MPS_MAX_DURATION:
                mapped["duration"] = MPS_MAX_DURATION

    params = build_generation_params(mapped, caption, lyrics)
    audio_format = pick_audio_format()
    config = GenerationConfig(
        batch_size=1,
        allow_lm_batch=False,
        use_random_seed=mapped["seed"] < 0,
        audio_format=audio_format,
    )

    print(
        f"[musicai] {job_id}: generate_music duration={mapped['duration']}s "
        f"lyrics={len(lyrics)} chars voice={job.get('voice')} "
        f"ref={'yes' if mapped.get('reference_audio') else 'no'} "
        f"caption={caption!r}"
    )
    release_unified_memory()
    result = generate_music(dit, llm, params, config, save_dir=str(SONGS))
    if (not result.success or not result.audios) and is_oom(result.error or result.status_message) and job["tight_memory"]:
        print(f"[musicai] {job_id}: MPS OOM — retrying with shorter lyrics and 90s duration")
        lyrics = clip_lyrics(lyrics, 1000)
        caption = clip_caption(caption, 300)
        mapped["duration"] = 90.0
        mapped["inference_steps"] = 8
        mapped["thinking"] = False
        mapped["use_cot_metas"] = False
        mapped["use_cot_language"] = False
        params = build_generation_params(mapped, caption, lyrics)
        release_unified_memory()
        result = generate_music(dit, llm, params, config, save_dir=str(SONGS))
    if not result.success or not result.audios:
        raise RuntimeError(result.error or result.status_message or "generation failed")

    audio = result.audios[0]
    dest = persist_song_audio(audio, job_id, audio_format)

    song = {
        "id": job_id,
        "style": job.get("style") or "",
        "lyrics": lyrics,
        "voice": job.get("voice") or "female",
        "language": job.get("language") or "auto",
        "influence": job.get("influence", 50),
        "weirdness": job.get("weirdness", 30),
        "voiceStrength": job.get("voiceStrength", 55),
        "duration": job.get("duration", -1),
        "bpm": mapped["bpm"],
        "seed": audio.get("params", {}).get("seed", mapped["seed"]),
        "caption": caption,
        "audioFile": dest.name,
        "createdAt": utc_now(),
    }
    write_json(SONGS / f"{job_id}.json", song)

    job["status"] = "done"
    job["songId"] = job_id
    job["error"] = None
    job["updatedAt"] = utc_now()
    write_json(path, job)
    print(f"[musicai] {job_id}: wrote {dest}")


def main() -> int:
    JOBS.mkdir(parents=True, exist_ok=True)
    SONGS.mkdir(parents=True, exist_ok=True)
    reset_stale_jobs()

    try:
        dit, llm, device, model, lm = load_handlers()
    except Exception as exc:
        write_heartbeat(ready=False, error=str(exc))
        print(f"[musicai] failed to load model: {exc}", file=sys.stderr)
        traceback.print_exc()
        return 1

    while True:
        write_heartbeat(
            ready=True,
            device=device,
            model=model,
            lm=lm,
            error=None,
            message="Model loaded on this Mac.",
        )
        pending = next_queued_job()
        if pending is None:
            time.sleep(1)
            continue
        path, job = pending
        try:
            run_job(dit, llm, path, job, device)
        except Exception as exc:
            traceback.print_exc()
            job["status"] = "error"
            job["error"] = str(exc)
            job["updatedAt"] = utc_now()
            write_json(path, job)


if __name__ == "__main__":
    raise SystemExit(main())
