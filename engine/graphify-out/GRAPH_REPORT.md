# Graph Report - engine  (2026-08-16)

## Corpus Check
- 8 files · ~5,791 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 108 nodes · 226 edges · 14 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `job_to_params()` - 21 edges
2. `run_job()` - 19 edges
3. `load_handlers()` - 14 edges
4. `ensure_checkpoints()` - 13 edges
5. `main()` - 10 edges
6. `update_heartbeat()` - 9 edges
7. `ensure_lm()` - 9 edges
8. `write_json()` - 8 edges
9. `normalize_lyrics_for_model()` - 8 edges
10. `utc_now()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `load_handlers()` --calls--> `ensure_checkpoints()`  [INFERRED]
  worker.py → download.py
- `load_handlers()` --calls--> `ensure_lm()`  [INFERRED]
  worker.py → download.py
- `run_job()` --calls--> `job_to_params()`  [INFERRED]
  worker.py → compose.py
- `run_job()` --calls--> `clip_caption()`  [INFERRED]
  worker.py → compose.py
- `run_job()` --calls--> `compose_caption()`  [INFERRED]
  worker.py → compose.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (21): clear_stale_hf_locks(), _dir_bytes(), _download_one(), _ensure_acestep_on_path(), ensure_checkpoints(), ensure_lm(), find_corrupt_weight_files(), _fmt_gb() (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.2
Nodes (10): compose_caption(), influence_to_guidance(), influence_to_lm_cfg(), Map studio job fields to ACE-Step GenerationParams values.  This module has no A, Remove gendered / register cues so reference audio can steer timbre., Remove gendered / register cues so reference audio can steer timbre., scrub_voice_bias(), voice_strength_to_cover() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.33
Nodes (10): job_to_params(), lyrics_budget(), test_allows_five_minute_songs(), test_auto_duration_not_forced_to_cap(), test_custom_voice_maps_reference(), test_custom_voice_maps_rvc(), test_custom_voice_requires_reference(), test_custom_voice_requires_rvc_model() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.42
Nodes (8): assert_dit_ready(), build_generation_params(), ffmpeg_available(), is_oom(), persist_song_audio(), pick_audio_format(), release_unified_memory(), run_job()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (9): load_settings(), load_handlers(), physical_memory_gb(), pick_backend(), pick_config(), pick_device(), pick_lm(), tight_memory() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (9): clip_lyrics(), _join_lyric_lines(), normalize_lyrics_for_model(), Keep lyric words; neutralize ellipsis that ACE-Step tends to skip.      Examples, _word_count(), Lines the model was dropping must remain as singable phrases., test_clip_lyrics_keeps_complete_sections(), test_normalize_lyrics_keeps_ellipsis_words() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.39
Nodes (8): _lock_for(), Merge fields into shared heartbeat state and write immediately., start_heartbeat_thread(), update_heartbeat(), update_job_progress(), utc_now(), write_heartbeat(), write_json()

### Community 7 - "Community 7"
Cohesion: 0.62
Nodes (6): convert(), main(), release_memory(), remix(), run(), separate()

### Community 8 - "Community 8"
Cohesion: 0.47
Nodes (6): main(), next_queued_job(), Exit when the studio UI has been gone long enough and no jobs are active., read_json(), reset_stale_jobs(), studio_idle_should_exit()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (5): apply_rvc_to_song(), Invoke isolated RVC env to convert song vocals (My Voice)., Return the uv-managed Python for the RVC venv, or raise a clear error., Run Demucs + RVC + remix in a subprocess (does not load into ACE-Step process)., rvc_python()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (3): ensure_reference_audio(), Require a readable reference file; convert WebM/Opus to WAV when needed., Require a readable reference file; convert WebM/Opus to WAV when needed.

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (1): Load MusicAI studio settings for the engine worker.

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): vocal_language(), test_devanagari_language()

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): clip_caption(), test_clip_caption_word_boundary()

## Knowledge Gaps
- **17 isolated node(s):** `Require a readable reference file; convert WebM/Opus to WAV when needed.`, `Merge fields into shared heartbeat state and write immediately.`, `Exit when the studio UI has been gone long enough and no jobs are active.`, `Lines the model was dropping must remain as singable phrases.`, `Map studio job fields to ACE-Step GenerationParams values.  This module has no A` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 11`** (2 nodes): `Load MusicAI studio settings for the engine worker.`, `settings_loader.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `vocal_language()`, `test_devanagari_language()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `clip_caption()`, `test_clip_caption_word_boundary()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_job()` connect `Community 3` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 13`?**
  _High betweenness centrality (0.467) - this node is a cross-community bridge._
- **Why does `load_handlers()` connect `Community 4` to `Community 8`, `Community 0`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.305) - this node is a cross-community bridge._
- **Why does `job_to_params()` connect `Community 2` to `Community 1`, `Community 3`, `Community 5`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.275) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `job_to_params()` (e.g. with `run_job()` and `test_job_to_params_normalizes_ellipsis_lyrics()`) actually correct?**
  _`job_to_params()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `run_job()` (e.g. with `job_to_params()` and `clip_caption()`) actually correct?**
  _`run_job()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `load_handlers()` (e.g. with `ensure_checkpoints()` and `ensure_lm()`) actually correct?**
  _`load_handlers()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Require a readable reference file; convert WebM/Opus to WAV when needed.`, `Merge fields into shared heartbeat state and write immediately.`, `Exit when the studio UI has been gone long enough and no jobs are active.` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._