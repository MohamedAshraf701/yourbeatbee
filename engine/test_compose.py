from compose import (
    MPS_MAX_DURATION,
    clip_caption,
    clip_lyrics,
    job_to_params,
    lyrics_budget,
    normalize_lyrics_for_model,
    vocal_language,
)


def test_clip_caption_word_boundary():
    text = "a " * 300
    clipped = clip_caption(text, 40)
    assert len(clipped) <= 40
    assert not clipped.endswith(" ")


def test_normalize_lyrics_keeps_ellipsis_words():
    raw = (
        "[Verse]\n"
        "Tum bin…\n"
        "Tum bin… main adhoora sa hoon,\n"
        "Hmm...\n"
        "…\n"
        "Dil yeh kahe..."
    )
    cleaned = normalize_lyrics_for_model(raw)
    assert "Tum bin" in cleaned
    assert "main adhoora sa hoon" in cleaned
    assert "Hmm" in cleaned
    assert "Dil yeh kahe" in cleaned
    assert "…" not in cleaned
    assert "..." not in cleaned
    assert cleaned.startswith("[Verse]")
    # No duplicated echo lines
    assert cleaned.count("Tum bin.") == 1


def test_normalize_user_ballad_skips():
    """Incomplete endings become full stops; no dual echo lines."""
    raw = """[Intro]

Hmm…
Tere baad bhi…
Tera intezaar hai…
Jaane kyun dil ko,
Aaj bhi tujhse pyaar hai…

[Verse 1]

Raaton mein teri baatein,
Chupke se aa jaati hain,
Aankhon ke in raaston se,
Yaadein beh jaati hain…

Jo khwaab tere sang dekhe,
Woh aaj bhi zinda hain,
Tu paas nahi hai mere,
Phir bhi tu mere andar hai…"""
    cleaned = normalize_lyrics_for_model(raw)
    assert "Tere baad bhi." in cleaned
    assert "Tera intezaar hai." in cleaned
    assert "Aaj bhi tujhse pyaar hai." in cleaned
    assert "Yaadein beh jaati hain." in cleaned
    # Trailing commas were being skipped like ellipsis
    assert "Woh aaj bhi zinda hain." in cleaned
    assert "Jaane kyun dil ko." in cleaned
    assert "Jo khwaab tere sang dekhe." in cleaned
    assert "…" not in cleaned
    assert cleaned.count("Tere baad bhi.") == 1
    assert "Tere baad bhi, tera intezaar hai" not in cleaned


def test_job_to_params_normalizes_ellipsis_lyrics():
    params = job_to_params(
        {
            "style": "bollywood ballad",
            "lyrics": "[Chorus]\nTum bin… ye dil nahi lagta,",
            "voice": "female",
            "duration": 30,
        }
    )
    assert "Tum bin" in params["lyrics"]
    assert "ye dil nahi lagta" in params["lyrics"]
    assert "…" not in params["lyrics"]
    assert "..." not in params["lyrics"]
    # User lyrics → no LM audio codes (better word adherence)
    assert params["thinking"] is False
    assert params["guidance_scale"] >= 10.0
    assert params["duration"] == 30.0


def test_auto_duration_scales_with_lyric_density():
    verse = "\n".join(f"line number {i} here," for i in range(40))
    params = job_to_params(
        {
            "style": "ballad",
            "lyrics": f"[Verse]\n{verse}",
            "voice": "male",
            "duration": -1,
            "tight_memory": True,
        }
    )
    assert params["duration"] >= 90.0
    assert "line number 20 here." in params["lyrics"]
    assert params["duration"] <= MPS_MAX_DURATION


def test_no_lyrics_still_uses_thinking():
    params = job_to_params(
        {
            "style": "indie pop",
            "lyrics": "",
            "voice": "female",
            "duration": 30,
        }
    )
    assert params["needs_sample"] is True
    assert params["thinking"] is True


def test_clip_lyrics_keeps_complete_sections():
    lyrics = (
        "[Intro]\nhello there this is intro text\n\n"
        "[Verse 1]\n" + ("line\n" * 40) + "\n"
        "[Chorus]\nkeep this chorus\n\n"
        "[Verse 2]\n" + ("more\n" * 80)
    )
    clipped = clip_lyrics(lyrics, 200)
    assert "[Intro]" in clipped
    assert "[Verse 2]" not in clipped
    assert not clipped.endswith("[Verse")


def test_devanagari_language():
    assert vocal_language("auto", "तुम पास हो") == "hi"
    assert vocal_language("en", "तुम पास हो") == "en"
    assert vocal_language("auto", "you are here") == "unknown"


def test_allows_five_minute_songs():
    assert MPS_MAX_DURATION == 300.0
    params = job_to_params(
        {
            "style": "ballad " * 80,
            "lyrics": "[Verse]\n" + ("word " * 800),
            "voice": "male",
            "duration": 300,
            "tight_memory": True,
        }
    )
    assert params["duration"] == 300.0
    assert params["inference_steps"] == 8
    assert params["use_cot_caption"] is False
    assert len(params["caption"]) <= 500
    assert len(params["lyrics"]) <= lyrics_budget(300, True)
    assert params["vocal_language"] == "unknown"


def test_auto_duration_not_forced_to_cap():
    params = job_to_params(
        {
            "style": "indie pop",
            "lyrics": "[Verse]\nhello",
            "voice": "female",
            "duration": -1,
            "tight_memory": True,
        }
    )
    assert params["duration"] == -1.0


def test_custom_voice_requires_rvc_model():
    try:
        job_to_params(
            {
                "style": "ballad",
                "lyrics": "[Verse]\nhello",
                "voice": "custom",
                "duration": 30,
            }
        )
        raise AssertionError("expected ValueError")
    except ValueError:
        pass


def test_custom_voice_maps_rvc():
    params = job_to_params(
        {
            "style": "Romantic ballad, soft piano",
            "lyrics": "[Verse]\nhello",
            "voice": "custom",
            "duration": 60,
            "rvcModelPath": "/tmp/model.pth",
            "rvcIndexPath": "/tmp/model.index",
            "voiceStrength": 70,
        }
    )
    assert params["apply_rvc"] is True
    assert params["rvc_model_path"] == "/tmp/model.pth"
    assert params["rvc_index_path"] == "/tmp/model.index"
    assert params["reference_audio"] is None
    assert params["thinking"] is False
    assert "lead vocal" in params["caption"].lower()


def test_non_custom_user_lyrics_skips_thinking():
    params = job_to_params(
        {
            "style": "indie pop",
            "lyrics": "[Verse]\nhello",
            "voice": "female",
            "duration": 30,
        }
    )
    assert params["thinking"] is False
    assert params["apply_rvc"] is False
    assert params["rvc_model_path"] is None


if __name__ == "__main__":
    test_clip_caption_word_boundary()
    test_normalize_lyrics_keeps_ellipsis_words()
    test_normalize_user_ballad_skips()
    test_job_to_params_normalizes_ellipsis_lyrics()
    test_auto_duration_scales_with_lyric_density()
    test_no_lyrics_still_uses_thinking()
    test_clip_lyrics_keeps_complete_sections()
    test_devanagari_language()
    test_allows_five_minute_songs()
    test_auto_duration_not_forced_to_cap()
    test_custom_voice_requires_rvc_model()
    test_custom_voice_maps_rvc()
    test_non_custom_user_lyrics_skips_thinking()
    print("ok")
