"""Map studio job fields to ACE-Step GenerationParams values.

This module has no ACE-Step import so it can be reasoned about without weights.
"""

from __future__ import annotations

import re
from typing import Any

VOICE_TAGS = {
    "male": "male vocal",
    "female": "female vocal",
    "instrumental": None,
    # Clear lead vocal for post-RVC conversion (identity comes from RVC, not ACE-Step).
    "custom": "clear solo lead vocal, natural singing, dry close-mic vocal take",
}

# Style prompts often force a stock singer ("male baritone") that fights My Voice.
_VOICE_BIAS = re.compile(
    r"\b(?:solo\s+)?(?:male|female|man|woman|boy|girl)\s+vocals?(?:\s+only)?\b|"
    r"\b(?:male|female)\s+(?:singer|voice)\b|"
    r"\b(?:baritone|tenor|alto|soprano|contralto|mezzo(?:-soprano)?)\b",
    re.IGNORECASE,
)

LANGUAGE_MAP = {
    "auto": "unknown",
    "hi": "hi",
    "en": "en",
}

# ACE-Step docs: caption < 512, lyrics < 4096. On Apple Silicon the lyric
# encoder attention is quadratic and is what OOMs first, so clip tighter
# for short songs; longer songs get a larger lyric budget.
MAX_CAPTION_CHARS = 500
MAX_LYRICS_CHARS = 4000
TIGHT_LYRICS_CHARS = 1400
TIGHT_CAPTION_CHARS = 500
MPS_MAX_DURATION = 300.0  # 5 minutes — ACE-Step supports up to ~10m on larger GPUs


def lyrics_budget(duration: float, tight_memory: bool) -> int:
    if not tight_memory:
        return MAX_LYRICS_CHARS
    if duration <= 0:
        return 2800
    if duration <= 45:
        return 1400
    if duration <= 90:
        return 2000
    if duration <= 150:
        return 2800
    return MAX_LYRICS_CHARS

_SECTION_SPLIT = re.compile(r"(?=\n\[)")
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
# Unicode ellipsis + ASCII runs of 2+ dots. ACE-Step often treats these as
# unfinished / fade markers and skips / truncates those words when singing.
_ELLIPSIS = re.compile(r"(?:\u2026|\u22ef|\u2025|\.{2,})")
_TRAILING_ELLIPSIS = re.compile(rf"(?:\s*{_ELLIPSIS.pattern})+\s*$")
_SECTION_TAG = re.compile(r"^\[[^\]]+\]\s*$")


def _sung_line_count(lyrics: str) -> int:
    return sum(
        1
        for line in (lyrics or "").splitlines()
        if line.strip() and not _SECTION_TAG.match(line.strip())
    )


def duration_for_lyrics(lyrics: str, duration: float, tight_memory: bool) -> float:
    """When duration is auto, give enough seconds so mid-verse lines aren't squeezed out."""
    if duration > 0:
        return duration
    lines = _sung_line_count(lyrics)
    if lines <= 0:
        return duration
    # ~3.2s per sung line for ballad pacing; keep within platform caps.
    cap = MPS_MAX_DURATION if tight_memory else 600.0
    suggested = max(90.0, min(cap, lines * 3.2))
    return float(suggested)


def normalize_lyrics_for_model(text: str) -> str:
    """Keep lyric words; neutralize incomplete line endings ACE-Step tends to skip.

    Examples:
      ``Tum bin…`` → ``Tum bin.``
      ``Woh aaj bhi zinda hain,`` → ``Woh aaj bhi zinda hain.``
      ``Tum bin… main adhoora`` → ``Tum bin, main adhoora``
      a line that is only ``...`` / ``…`` is dropped
    """
    text = text or ""
    if not text.strip():
        return text.strip()

    out_lines: list[str] = []
    for raw in text.splitlines():
        had_trail = bool(_TRAILING_ELLIPSIS.search(raw.rstrip()))
        line = raw
        # Mid-phrase: "word… word" → "word, word"
        line = re.sub(
            rf"(\S)\s*{_ELLIPSIS.pattern}\s+(?=\S)",
            r"\1, ",
            line,
        )
        line = _ELLIPSIS.sub("", line)
        line = re.sub(r"[ \t]{2,}", " ", line)
        line = re.sub(r"\s+([,.;!?])", r"\1", line)
        line = re.sub(r",\s*,+", ",", line)
        stripped = line.strip()
        if not stripped and raw.strip():
            continue
        if not stripped:
            out_lines.append("")
            continue
        cleaned = line.rstrip() if line[:1].isspace() else stripped
        if _SECTION_TAG.match(cleaned):
            out_lines.append(cleaned)
            continue
        # Trailing ellipsis / comma / semicolon all read as "unfinished" and
        # get dropped mid-verse (e.g. "Woh aaj bhi zinda hain,").
        if had_trail and cleaned[-1] not in ".,;:!?":
            cleaned = f"{cleaned}."
        elif cleaned.endswith((",", ";")):
            cleaned = cleaned[:-1].rstrip() + "."
        out_lines.append(cleaned)

    cleaned_lines: list[str] = []
    blank_run = 0
    for line in out_lines:
        if line == "":
            blank_run += 1
            if blank_run <= 1:
                cleaned_lines.append("")
        else:
            blank_run = 0
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def scrub_voice_bias(style: str) -> str:
    """Remove gendered / register cues so reference audio can steer timbre."""
    cleaned = _VOICE_BIAS.sub(" ", style or "")
    cleaned = re.sub(r"\s*,\s*,+", ", ", cleaned)
    cleaned = re.sub(r",\s*(?=,)", "", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;])", r"\1", cleaned)
    cleaned = re.sub(r"(^|,\s*)only\b", r"\1", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*,\s*,+", ", ", cleaned)
    return cleaned.strip(" ,.;")


def compose_caption(style: str, voice: str) -> str:
    style = (style or "").strip().rstrip(".")
    if voice == "custom":
        style = scrub_voice_bias(style)
    tag = VOICE_TAGS.get(voice)
    if not tag:
        return style
    if tag.lower() in style.lower():
        return style
    if style:
        return f"{style}. {tag}."
    return f"{tag}."


def influence_to_guidance(influence: int) -> float:
    value = max(0, min(100, int(influence)))
    return round(1.0 + (value / 100.0) * 14.0, 2)


def influence_to_lm_cfg(influence: int) -> float:
    value = max(0, min(100, int(influence)))
    return round(1.0 + (value / 100.0) * 2.5, 2)


def weirdness_to_temperature(weirdness: int) -> float:
    value = max(0, min(100, int(weirdness)))
    return round(0.4 + (value / 100.0) * 1.0, 2)


def weirdness_to_infer_method(weirdness: int) -> str:
    return "sde" if int(weirdness) >= 70 else "ode"


def voice_strength_to_cover(strength: int) -> float:
    value = max(0, min(100, int(strength)))
    # With My Voice we disable LM audio codes, so this is ACE-Step's
    # reference similarity / denoise blend (higher = stick closer to ref).
    return round(0.35 + (value / 100.0) * 0.6, 2)


def vocal_language(language: str, lyrics: str = "") -> str:
    mapped = LANGUAGE_MAP.get(language, "unknown")
    if mapped != "unknown":
        return mapped
    if _DEVANAGARI.search(lyrics or ""):
        return "hi"
    return "unknown"


def clip_caption(text: str, limit: int = MAX_CAPTION_CHARS) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(".,;")
    return cut or text[:limit]


def clip_lyrics(text: str, limit: int = MAX_LYRICS_CHARS) -> str:
    text = normalize_lyrics_for_model(text or "")
    if len(text) <= limit:
        return text
    assembled = ""
    for section in _SECTION_SPLIT.split(text):
        candidate = f"{assembled}{section}".strip() if assembled else section.strip()
        if len(candidate) <= limit:
            assembled = candidate
        else:
            break
    if assembled and len(assembled) >= min(200, limit // 4):
        return assembled
    chunk = text[:limit]
    nl = chunk.rfind("\n")
    if nl > limit // 2:
        chunk = chunk[:nl]
    return chunk.strip()


def job_to_params(job: dict[str, Any]) -> dict[str, Any]:
    voice = job.get("voice") or "female"
    style = job.get("style") or ""
    lyrics = normalize_lyrics_for_model((job.get("lyrics") or "").strip())
    duration = job.get("duration")
    bpm = job.get("bpm")
    seed = job.get("seed", -1)
    influence = int(job.get("influence", 50))
    weirdness = int(job.get("weirdness", 30))
    fast = bool(job.get("fast", False))
    tight_memory = bool(job.get("tight_memory", False))
    instrumental = voice == "instrumental"
    custom_voice = voice == "custom"
    voice_strength = int(job.get("voiceStrength", job.get("voice_strength", 75)))
    rvc_model = (job.get("rvcModelPath") or job.get("rvc_model_path") or "").strip() or None
    rvc_index = (job.get("rvcIndexPath") or job.get("rvc_index_path") or "").strip() or None

    if custom_voice and not rvc_model:
        raise ValueError("custom voice requires an imported RVC model (rvcModelPath)")

    if instrumental and not lyrics:
        lyrics = "[Instrumental]"

    caption_limit = TIGHT_CAPTION_CHARS if tight_memory else MAX_CAPTION_CHARS
    if duration in (None, -1, 0, "auto"):
        duration_value = -1.0
    else:
        duration_value = float(duration)
        if tight_memory and duration_value > MPS_MAX_DURATION:
            duration_value = MPS_MAX_DURATION
        elif duration_value > 600:
            duration_value = 600.0

    # Auto duration + dense lyrics → LM often picks a short track and mid-verse
    # lines (e.g. "Woh aaj bhi zinda hain") get squeezed out of the timeline.
    if (
        duration_value <= 0
        and _sung_line_count(lyrics) >= 12
        and lyrics.strip().lower() not in {"[instrumental]", "[inst]"}
    ):
        duration_value = duration_for_lyrics(lyrics, duration_value, tight_memory)

    lyrics_limit = lyrics_budget(duration_value, tight_memory)
    lyrics = clip_lyrics(lyrics, lyrics_limit)
    language = vocal_language(job.get("language") or "auto", lyrics)

    # User-written lyrics: skip LM audio-code planning so DiT follows the
    # words more closely (codes were compressing intros and dropping phrases).
    # Still use CoT for BPM/duration. When lyrics are empty, keep thinking so
    # create_sample + codes can invent the song.
    has_user_lyrics = bool(lyrics.strip()) and lyrics.strip().lower() not in {
        "[instrumental]",
        "[inst]",
    }
    thinking = not has_user_lyrics

    # Slightly stronger CFG when singing fixed lyrics so endings land.
    guidance = influence_to_guidance(influence)
    lm_cfg = influence_to_lm_cfg(influence)
    if has_user_lyrics:
        guidance = max(guidance, 10.0)
        lm_cfg = max(lm_cfg, 2.5)

    return {
        "caption": clip_caption(compose_caption(style, voice), caption_limit),
        "lyrics": lyrics,
        "instrumental": instrumental,
        "vocal_language": language,
        "duration": duration_value,
        "bpm": int(bpm) if bpm else None,
        "seed": int(seed) if seed is not None else -1,
        "guidance_scale": guidance,
        "lm_cfg_scale": lm_cfg,
        "lm_temperature": weirdness_to_temperature(weirdness),
        "infer_method": weirdness_to_infer_method(weirdness),
        "thinking": thinking,
        "use_cot_caption": False,
        "use_cot_language": language == "unknown",
        "use_cot_metas": True,
        "inference_steps": 8 if (fast or tight_memory) else 32,
        "task_type": "text2music",
        "needs_sample": not lyrics and not instrumental,
        "sample_query": style.strip() or "original song with vocals and instrumentation",
        "tight_memory": tight_memory,
        "lyrics_limit": lyrics_limit,
        "reference_audio": None,
        "audio_cover_strength": 0.0,
        "rvc_model_path": rvc_model if custom_voice else None,
        "rvc_index_path": rvc_index if custom_voice else None,
        "voice_strength": voice_strength if custom_voice else 0,
        "apply_rvc": custom_voice,
    }
