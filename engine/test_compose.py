from compose import (
    MPS_MAX_DURATION,
    clip_caption,
    clip_lyrics,
    job_to_params,
    lyrics_budget,
    vocal_language,
)


def test_clip_caption_word_boundary():
    text = "a " * 300
    clipped = clip_caption(text, 40)
    assert len(clipped) <= 40
    assert not clipped.endswith(" ")


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


def test_custom_voice_requires_reference():
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


def test_custom_voice_maps_reference():
    params = job_to_params(
        {
            "style": "Romantic ballad, solo male vocal only, warm emotional baritone, soft piano",
            "lyrics": "[Verse]\nhello",
            "voice": "custom",
            "duration": 60,
            "referenceAudio": "/tmp/voice.wav",
            "voiceStrength": 70,
        }
    )
    assert params["reference_audio"] == "/tmp/voice.wav"
    assert params["thinking"] is False
    assert 0.35 <= params["audio_cover_strength"] <= 0.95
    assert "reference singer" in params["caption"]
    assert "baritone" not in params["caption"].lower()
    assert "male vocal" not in params["caption"].lower()


def test_non_custom_still_thinks():
    params = job_to_params(
        {
            "style": "indie pop",
            "lyrics": "[Verse]\nhello",
            "voice": "female",
            "duration": 30,
        }
    )
    assert params["thinking"] is True
    assert params["reference_audio"] is None


if __name__ == "__main__":
    test_clip_caption_word_boundary()
    test_clip_lyrics_keeps_complete_sections()
    test_devanagari_language()
    test_allows_five_minute_songs()
    test_auto_duration_not_forced_to_cap()
    test_custom_voice_requires_reference()
    test_custom_voice_maps_reference()
    test_non_custom_still_thinks()
    print("ok")
