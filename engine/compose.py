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
    "custom": "solo vocal matching the reference singer timbre",
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
    text = (text or "").strip()
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
    lyrics = (job.get("lyrics") or "").strip()
    duration = job.get("duration")
    bpm = job.get("bpm")
    seed = job.get("seed", -1)
    influence = int(job.get("influence", 50))
    weirdness = int(job.get("weirdness", 30))
    fast = bool(job.get("fast", False))
    tight_memory = bool(job.get("tight_memory", False))
    instrumental = voice == "instrumental"
    custom_voice = voice == "custom"
    reference_audio = (job.get("referenceAudio") or job.get("reference_audio") or "").strip() or None
    voice_strength = int(job.get("voiceStrength", job.get("voice_strength", 55)))

    if custom_voice and not reference_audio:
        raise ValueError("custom voice requires referenceAudio path")

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

    lyrics_limit = lyrics_budget(duration_value, tight_memory)
    lyrics = clip_lyrics(lyrics, lyrics_limit)
    language = vocal_language(job.get("language") or "auto", lyrics)

    # My Voice: never let the LM invent audio codes. Those switch the run into
    # "cover from codes" and drown out the reference singer timbre.
    thinking = False if custom_voice else True

    return {
        "caption": clip_caption(compose_caption(style, voice), caption_limit),
        "lyrics": lyrics,
        "instrumental": instrumental,
        "vocal_language": language,
        "duration": duration_value,
        "bpm": int(bpm) if bpm else None,
        "seed": int(seed) if seed is not None else -1,
        "guidance_scale": influence_to_guidance(influence),
        "lm_cfg_scale": influence_to_lm_cfg(influence),
        "lm_temperature": weirdness_to_temperature(weirdness),
        "infer_method": weirdness_to_infer_method(weirdness),
        "thinking": thinking,
        "use_cot_caption": False,
        "use_cot_language": language == "unknown" and not custom_voice,
        "use_cot_metas": True,
        "inference_steps": 8 if (fast or tight_memory) else 32,
        "task_type": "text2music",
        "needs_sample": not lyrics and not instrumental,
        "sample_query": style.strip() or "original song with vocals and instrumentation",
        "tight_memory": tight_memory,
        "lyrics_limit": lyrics_limit,
        "reference_audio": reference_audio if custom_voice else None,
        "audio_cover_strength": voice_strength_to_cover(voice_strength) if custom_voice else 0.0,
    }
