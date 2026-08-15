"""Download ACE-Step checkpoints with visible, resumable progress.

ACE-Step's snapshot_download + hf_transfer often prints nothing for a long time
on Mac, which looks like a hang. We pull files one-by-one with tqdm instead.
"""

from __future__ import annotations

import os
import struct
import sys
import threading
import time
from pathlib import Path

REPO = "ACE-Step/Ace-Step1.5"
LM_REPOS = {
    "acestep-5Hz-lm-0.6B": "ACE-Step/acestep-5Hz-lm-0.6B",
    "acestep-5Hz-lm-4B": "ACE-Step/acestep-5Hz-lm-4B",
}

# Do not use hf_transfer — it hides tqdm and can sit silent for 20+ minutes.
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

WEIGHT_SUFFIXES = {".safetensors", ".bin", ".pt", ".ckpt"}


def _vendor() -> Path:
    return Path(__file__).resolve().parents[1] / "vendor" / "ACE-Step-1.5"


def _ensure_acestep_on_path() -> None:
    vendor = _vendor()
    if str(vendor) not in sys.path:
        sys.path.insert(0, str(vendor))


def clear_stale_hf_locks(checkpoints: Path) -> int:
    cache = checkpoints / ".cache"
    if not cache.exists():
        return 0
    removed = 0
    for path in cache.rglob("*"):
        if path.suffix == ".lock" or path.name.endswith(".lock"):
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
    return removed


def is_valid_safetensors(path: Path) -> bool:
    """Return True when the file has a non-empty JSON safetensors header."""
    try:
        size = path.stat().st_size
        if size < 16:
            return False
        with path.open("rb") as handle:
            header_len = struct.unpack("<Q", handle.read(8))[0]
            if header_len <= 2 or header_len > size - 8:
                return False
            start = handle.read(1)
            return start == b"{"
    except OSError:
        return False


def find_corrupt_weight_files(checkpoints: Path) -> list[Path]:
    bad: list[Path] = []
    if not checkpoints.exists():
        return bad
    for path in checkpoints.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix == ".safetensors" and not is_valid_safetensors(path):
            bad.append(path)
        elif path.suffix in WEIGHT_SUFFIXES and path.stat().st_size == 0:
            bad.append(path)
    return bad


def repair_corrupt_weights(checkpoints: Path, log=print) -> int:
    """Delete corrupt weight files so the next download replaces them."""
    bad = find_corrupt_weight_files(checkpoints)
    for path in bad:
        log(f"[musicai] Removing corrupt weight: {path.relative_to(checkpoints)}")
        try:
            path.unlink()
        except OSError as exc:
            log(f"[musicai] Could not remove {path}: {exc}")
    # Also drop incomplete stubs for those same relative names.
    for path in checkpoints.rglob("*.incomplete"):
        try:
            path.unlink()
            log(f"[musicai] Cleared incomplete: {path.name}")
        except OSError:
            pass
    return len(bad)


def _dir_bytes(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for file in path.rglob("*"):
        if file.is_file():
            try:
                total += file.stat().st_size
            except OSError:
                pass
    return total


def _fmt_gb(num: int) -> str:
    return f"{num / (1024 ** 3):.2f} GB"


def _print_resume_state(checkpoints: Path, log) -> None:
    incompletes = list(checkpoints.rglob("*.incomplete"))
    if not incompletes:
        return
    log("[musicai] Resuming partial downloads:")
    for path in incompletes:
        log(f"  - {path.name[:24]}… {_fmt_gb(path.stat().st_size)}")


def models_ready(checkpoints: Path) -> bool:
    _ensure_acestep_on_path()
    from acestep.model_downloader import check_main_model_exists

    if find_corrupt_weight_files(checkpoints):
        return False
    return check_main_model_exists(checkpoints)


def _list_repo_files(log, repo_id: str = REPO) -> list[str]:
    from huggingface_hub import list_repo_files

    log(f"[musicai] Listing files on Hugging Face for {repo_id} (can take ~30s)...")
    return list(list_repo_files(repo_id))


def _should_skip(dest: Path) -> bool:
    if not dest.exists() or dest.stat().st_size == 0:
        return False
    if dest.suffix == ".safetensors":
        return is_valid_safetensors(dest)
    if dest.suffix in WEIGHT_SUFFIXES:
        return dest.stat().st_size > 50 * 1024 * 1024
    return True


def _download_one(
    filename: str,
    dest_dir: Path,
    log,
    repo_id: str = REPO,
) -> None:
    from huggingface_hub import hf_hub_download

    dest = dest_dir / filename
    if _should_skip(dest):
        log(f"[musicai] skip {filename} (already {_fmt_gb(dest.stat().st_size)})")
        return

    if dest.exists() and dest.suffix == ".safetensors" and not is_valid_safetensors(dest):
        log(f"[musicai] re-download corrupt {filename}")
        dest.unlink(missing_ok=True)

    log(f"[musicai] downloading {filename}")
    path = Path(
        hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=str(dest_dir),
        )
    )
    if path.suffix == ".safetensors" and not is_valid_safetensors(path):
        path.unlink(missing_ok=True)
        raise RuntimeError(
            f"Downloaded {filename} but the safetensors header is still invalid. "
            "Check your network and re-run npm run download:models."
        )


def _start_size_watch(checkpoints: Path, log) -> threading.Event:
    stop = threading.Event()
    last = _dir_bytes(checkpoints)

    def loop() -> None:
        nonlocal last
        while not stop.wait(15):
            now = _dir_bytes(checkpoints)
            delta = now - last
            log(
                f"[musicai] on disk {_fmt_gb(now)} "
                f"({'+' if delta >= 0 else ''}{delta / (1024 ** 2):.0f} MB / 15s)"
            )
            last = now

    threading.Thread(target=loop, daemon=True).start()
    return stop


def ensure_checkpoints(checkpoints: Path, log=print) -> None:
    _ensure_acestep_on_path()
    checkpoints.mkdir(parents=True, exist_ok=True)

    removed = clear_stale_hf_locks(checkpoints)
    if removed:
        log(f"[musicai] Cleared {removed} stale Hugging Face lock file(s).")

    repaired = repair_corrupt_weights(checkpoints, log)
    if repaired:
        log(f"[musicai] Removed {repaired} corrupt weight file(s); will re-download.")

    from acestep.model_downloader import check_main_model_exists, _sync_model_code_files

    if models_ready(checkpoints):
        log("[musicai] Checkpoints already on disk and valid.")
        return

    log("")
    log("[musicai] Downloading ACE-Step/Ace-Step1.5 one file at a time.")
    log("[musicai] You should see a per-file progress bar. Ctrl+C and re-run resumes.")
    log("")
    _print_resume_state(checkpoints, log)
    log(f"[musicai] Current folder size: {_fmt_gb(_dir_bytes(checkpoints))}")

    started = time.time()
    watch = _start_size_watch(checkpoints, log)
    try:
        files = _list_repo_files(log)
        log(f"[musicai] {len(files)} files in repo.")
        for index, filename in enumerate(files, start=1):
            log(f"[musicai] ({index}/{len(files)}) {filename}")
            _download_one(filename, checkpoints, log)
    finally:
        watch.set()

    if not models_ready(checkpoints):
        bad = find_corrupt_weight_files(checkpoints)
        detail = ", ".join(str(p.relative_to(checkpoints)) for p in bad[:5])
        raise RuntimeError(
            "Download finished but required weights are still missing or corrupt"
            + (f" ({detail})" if detail else "")
            + ". Re-run npm run download:models."
        )

    for name in ("acestep-v15-turbo", "acestep-v15-sft", "acestep-v15-base"):
        try:
            _sync_model_code_files(name, checkpoints)
        except Exception:
            pass

    elapsed = int(time.time() - started)
    log(f"[musicai] Download complete in {elapsed}s. Size {_fmt_gb(_dir_bytes(checkpoints))}")


def lm_ready(checkpoints: Path, lm_name: str) -> bool:
    dest = checkpoints / lm_name
    if not dest.is_dir():
        return False
    weights = [
        path
        for path in dest.rglob("*")
        if path.is_file() and path.suffix in WEIGHT_SUFFIXES
    ]
    if not weights:
        return False
    return not any(
        path.suffix == ".safetensors" and not is_valid_safetensors(path) for path in weights
    )


def ensure_lm(checkpoints: Path, lm_name: str, log=print) -> None:
    """Download a separately hosted LM (0.6B / 4B). 1.7B ships in the main snapshot."""
    if not lm_name or lm_name == "acestep-5Hz-lm-1.7B":
        return
    repo_id = LM_REPOS.get(lm_name)
    if not repo_id:
        raise RuntimeError(f"Unknown LM model {lm_name!r}. Use one of: {', '.join(LM_REPOS)}")

    dest = checkpoints / lm_name
    dest.mkdir(parents=True, exist_ok=True)
    if lm_ready(checkpoints, lm_name):
        log(f"[musicai] LM {lm_name} already on disk ({_fmt_gb(_dir_bytes(dest))}).")
        return

    log("")
    log(f"[musicai] Downloading {repo_id} into {dest.name}/")
    log("[musicai] This is the smaller language model for this Mac. Ctrl+C and re-run resumes.")
    log("")
    watch = _start_size_watch(dest, log)
    try:
        files = _list_repo_files(log, repo_id)
        log(f"[musicai] {len(files)} files in {lm_name}.")
        for index, filename in enumerate(files, start=1):
            log(f"[musicai] ({index}/{len(files)}) {filename}")
            _download_one(filename, dest, log, repo_id=repo_id)
    finally:
        watch.set()

    if not lm_ready(checkpoints, lm_name):
        raise RuntimeError(
            f"Download finished but {lm_name} is still missing or corrupt. "
            "Re-run npm run download:models."
        )
    log(f"[musicai] LM {lm_name} ready ({_fmt_gb(_dir_bytes(dest))}).")
