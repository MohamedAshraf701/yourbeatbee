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
from settings_loader import load_settings  # noqa: E402


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

# Shared heartbeat state — background thread keeps updatedAt fresh during long work.
_HB_LOCK = threading.Lock()
_HB_STATE: dict[str, object] = {
    "ready": False,
    "phase": "starting",
    "progress": 0,
    "busy": False,
    "message": "Starting engine…",
    "error": None,
    "device": None,
    "model": None,
    "lm": None,
}
_HB_STOP: threading.Event | None = None


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


def update_heartbeat(**extra: object) -> None:
    """Merge fields into shared heartbeat state and write immediately."""
    with _HB_LOCK:
        _HB_STATE.update(extra)
        payload = {
            "updatedAt": utc_now(),
            "pid": os.getpid(),
            **dict(_HB_STATE),
        }
    try:
        write_json(ENGINE_FILE, payload)
    except OSError as exc:
        print(f"[musicai] heartbeat write skipped: {exc}", file=sys.stderr)


def start_heartbeat_thread() -> threading.Event:
    global _HB_STOP
    if _HB_STOP is not None:
        _HB_STOP.set()
    stop = threading.Event()
    _HB_STOP = stop

    def loop() -> None:
        while not stop.wait(3):
            update_heartbeat()

    thread = threading.Thread(target=loop, daemon=True, name="musicai-heartbeat")
    thread.start()
    update_heartbeat()
    return stop


def update_job_progress(
    path: Path,
    job: dict,
    *,
    phase: str,
    progress: int,
    message: str,
) -> None:
    job["phase"] = phase
    job["progress"] = max(0, min(100, int(progress)))
    job["message"] = message
    job["updatedAt"] = utc_now()
    write_json(path, job)
    update_heartbeat(
        ready=True,
        busy=True,
        phase=phase,
        progress=job["progress"],
        message=message,
        error=None,
    )

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
    settings = load_settings()
    preferred = str(settings.get("device") or "auto").strip().lower()
    if preferred in {"mps", "cuda", "cpu"}:
        return preferred
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def pick_lm(mem_gb: float) -> str:
    env = os.environ.get("ACESTEP_LM_MODEL_PATH")
    if env:
        return env
    settings = load_settings()
    preferred = str(settings.get("lmModel") or "").strip()
    if preferred:
        return preferred
    # Align with frontend recommendation table.
    return "acestep-5Hz-lm-1.7B" if mem_gb >= 32 else "acestep-5Hz-lm-0.6B"


def pick_backend() -> str:
    env = os.environ.get("ACESTEP_LM_BACKEND")
    if env:
        return env
    settings = load_settings()
    preferred = str(settings.get("backend") or "auto").strip().lower()
    if preferred in {"mlx", "pt"}:
        return preferred
    return "mlx" if sys.platform == "darwin" else "pt"


def tight_memory(device: str) -> bool:
    settings = load_settings()
    if settings.get("saveMemory") is False and physical_memory_gb() >= 32:
        return device == "mps" and physical_memory_gb() < 24
    return device == "mps" and physical_memory_gb() < 32


def pick_config() -> str:
    env = os.environ.get("ACESTEP_CONFIG_PATH")
    if env:
        return env
    settings = load_settings()
    preferred = str(settings.get("ditModel") or "").strip()
    if preferred:
        return preferred
    return "acestep-v15-turbo"


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

    start_heartbeat_thread()
    update_heartbeat(
        ready=False,
        busy=True,
        phase="downloading",
        progress=5,
        device=device,
        model=config_path,
        lm=lm_model,
        error=None,
        message="Checking / downloading ACE-Step weights…",
    )
    print(f"[musicai] device={device} backend={backend} model={config_path} lm={lm_model} ram≈{mem_gb:.1f}GB")
    dit = None
    llm = None
    try:
        ensure_checkpoints(Path(checkpoint_dir))
        update_heartbeat(
            phase="downloading",
            progress=25,
            message=f"Checking LM weights ({lm_model})…",
        )
        ensure_lm(Path(checkpoint_dir), lm_model)
        update_heartbeat(
            ready=False,
            busy=True,
            phase="loading_dit",
            progress=40,
            device=device,
            model=config_path,
            lm=lm_model,
            error=None,
            message="Loading DiT / VAE / text encoder into memory…",
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

        update_heartbeat(
            phase="loading_lm",
            progress=70,
            message=f"Loading language model ({lm_model})…",
        )
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
                update_heartbeat(
                    progress=80,
                    message="MLX LM failed — retrying with PyTorch…",
                )
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
        update_heartbeat(
            ready=False,
            busy=False,
            phase="error",
            progress=0,
            device=device,
            model=config_path,
            lm=lm_model,
            error="Model failed to load. See engine terminal logs.",
            message="Engine failed during model load.",
        )
        raise

    update_heartbeat(
        ready=True,
        busy=False,
        phase="idle",
        progress=100,
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
    update_job_progress(
        path,
        job,
        phase="preparing",
        progress=5,
        message="Preparing generation…",
    )

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

    if mapped.get("apply_rvc"):
        print(
            f"[musicai] {job_id}: My Voice RVC model={mapped.get('rvc_model_path')} "
            f"index={'yes' if mapped.get('rvc_index_path') else 'no'} "
            f"strength={mapped.get('voice_strength')}"
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
        update_job_progress(
            path,
            job,
            phase="lyrics",
            progress=15,
            message="LM is writing lyrics…",
        )
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
        f"rvc={'yes' if mapped.get('apply_rvc') else 'no'} "
        f"caption={caption!r}"
    )
    update_job_progress(
        path,
        job,
        phase="generating",
        progress=30,
        message="Generating song (diffusion) — this can take several minutes…",
    )
    release_unified_memory()
    gen_stop = threading.Event()

    def creep_progress() -> None:
        pct = 30
        while not gen_stop.wait(8):
            pct = min(68, pct + 2)
            update_job_progress(
                path,
                job,
                phase="generating",
                progress=pct,
                message="Generating song (diffusion) — this can take several minutes…",
            )

    creep = threading.Thread(target=creep_progress, daemon=True)
    creep.start()
    try:
        result = generate_music(dit, llm, params, config, save_dir=str(SONGS))
    finally:
        gen_stop.set()
    if (not result.success or not result.audios) and is_oom(result.error or result.status_message) and job["tight_memory"]:
        print(f"[musicai] {job_id}: MPS OOM — retrying with shorter lyrics and 90s duration")
        update_job_progress(
            path,
            job,
            phase="generating",
            progress=45,
            message="Out of memory — retrying with shorter song…",
        )
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

    update_job_progress(
        path,
        job,
        phase="saving",
        progress=75,
        message="Saving audio…",
    )
    audio = result.audios[0]
    dest = persist_song_audio(audio, job_id, audio_format)

    if mapped.get("apply_rvc"):
        from voice_convert import apply_rvc_to_song

        model_path = Path(mapped["rvc_model_path"])
        index_raw = mapped.get("rvc_index_path")
        index_path = Path(index_raw) if index_raw else None
        print(f"[musicai] {job_id}: releasing ACE-Step caches before RVC…")
        update_job_progress(
            path,
            job,
            phase="rvc",
            progress=82,
            message="My Voice: separating stems + RVC convert…",
        )
        release_unified_memory()
        apply_rvc_to_song(
            dest,
            model_path,
            index_path if index_path and index_path.is_file() else None,
            int(mapped.get("voice_strength") or 75),
        )
        release_unified_memory()

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
    job["phase"] = "done"
    job["progress"] = 100
    job["message"] = "Song ready."
    job["updatedAt"] = utc_now()
    write_json(path, job)
    update_heartbeat(
        ready=True,
        busy=False,
        phase="idle",
        progress=100,
        message="Model loaded on this Mac.",
        error=None,
    )
    print(f"[musicai] {job_id}: wrote {dest}")


def studio_idle_should_exit() -> bool:
    """Exit when the studio UI has been gone long enough and no jobs are active."""
    presence = DATA / "studio-presence.json"
    if not presence.is_file():
        return False
    try:
        data = json.loads(presence.read_text(encoding="utf-8"))
        last = data.get("lastSeenAt")
        if not last:
            return False
        seen = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - seen.astimezone(timezone.utc)).total_seconds()
        if age < 90:
            return False
    except Exception:
        return False
    for path in JOBS.glob("*.json"):
        job = read_json(path)
        if job and job.get("status") in {"queued", "running"}:
            return False
    return True


def main() -> int:
    JOBS.mkdir(parents=True, exist_ok=True)
    SONGS.mkdir(parents=True, exist_ok=True)
    reset_stale_jobs()

    try:
        dit, llm, device, model, lm = load_handlers()
    except Exception as exc:
        update_heartbeat(ready=False, busy=False, phase="error", error=str(exc))
        print(f"[musicai] failed to load model: {exc}", file=sys.stderr)
        traceback.print_exc()
        return 1

    while True:
        if studio_idle_should_exit():
            print("[musicai] Studio UI idle — unloading engine to free memory.")
            update_heartbeat(
                ready=False,
                busy=False,
                phase="stopped",
                progress=0,
                message="Engine stopped (studio closed).",
                error=None,
            )
            return 0

        update_heartbeat(
            ready=True,
            busy=False,
            phase="idle",
            progress=100,
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
            job["phase"] = "error"
            job["message"] = str(exc)
            job["updatedAt"] = utc_now()
            write_json(path, job)
            update_heartbeat(
                ready=True,
                busy=False,
                phase="idle",
                progress=100,
                message="Model loaded on this Mac.",
                error=None,
            )


if __name__ == "__main__":
    raise SystemExit(main())
