# Graph Report - engine  (2026-08-15)

## Corpus Check
- 5 files · ~3,786 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 75 nodes · 161 edges · 13 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `job_to_params()` - 17 edges
2. `run_job()` - 16 edges
3. `load_handlers()` - 13 edges
4. `ensure_checkpoints()` - 13 edges
5. `ensure_lm()` - 9 edges
6. `main()` - 8 edges
7. `write_json()` - 6 edges
8. `write_heartbeat()` - 6 edges
9. `is_valid_safetensors()` - 6 edges
10. `_download_one()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `test_auto_duration_not_forced_to_cap()` --calls--> `job_to_params()`  [INFERRED]
  test_compose.py → compose.py
- `test_custom_voice_requires_reference()` --calls--> `job_to_params()`  [INFERRED]
  test_compose.py → compose.py
- `test_custom_voice_maps_reference()` --calls--> `job_to_params()`  [INFERRED]
  test_compose.py → compose.py
- `test_non_custom_still_thinks()` --calls--> `job_to_params()`  [INFERRED]
  test_compose.py → compose.py
- `load_handlers()` --calls--> `ensure_checkpoints()`  [INFERRED]
  worker.py → download.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.35
Nodes (10): assert_dit_ready(), load_handlers(), physical_memory_gb(), pick_backend(), pick_config(), pick_device(), pick_lm(), start_heartbeat_thread() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.36
Nodes (9): influence_to_guidance(), influence_to_lm_cfg(), job_to_params(), lyrics_budget(), Map studio job fields to ACE-Step GenerationParams values.  This module has no A, voice_strength_to_cover(), weirdness_to_infer_method(), weirdness_to_temperature() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (9): build_generation_params(), ensure_reference_audio(), ffmpeg_available(), is_oom(), persist_song_audio(), pick_audio_format(), Require a readable reference file; convert WebM/Opus to WAV when needed., release_unified_memory() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.43
Nodes (8): _lock_for(), main(), next_queued_job(), read_json(), reset_stale_jobs(), utc_now(), write_heartbeat(), write_json()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (6): clip_caption(), test_auto_duration_not_forced_to_cap(), test_clip_caption_word_boundary(), test_custom_voice_maps_reference(), test_custom_voice_requires_reference(), test_non_custom_still_thinks()

### Community 5 - "Community 5"
Cohesion: 0.4
Nodes (6): _dir_bytes(), ensure_lm(), _list_repo_files(), lm_ready(), Download a separately hosted LM (0.6B / 4B). 1.7B ships in the main snapshot., _start_size_watch()

### Community 6 - "Community 6"
Cohesion: 0.6
Nodes (5): ensure_checkpoints(), find_corrupt_weight_files(), models_ready(), Delete corrupt weight files so the next download replaces them., repair_corrupt_weights()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (4): clear_stale_hf_locks(), _ensure_acestep_on_path(), Download ACE-Step checkpoints with visible, resumable progress.  ACE-Step's snap, _vendor()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (4): _download_one(), is_valid_safetensors(), Return True when the file has a non-empty JSON safetensors header., _should_skip()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): compose_caption(), Remove gendered / register cues so reference audio can steer timbre., scrub_voice_bias()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): clip_lyrics(), test_clip_lyrics_keeps_complete_sections()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): vocal_language(), test_devanagari_language()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): _fmt_gb(), _print_resume_state()

## Knowledge Gaps
- **7 isolated node(s):** `Require a readable reference file; convert WebM/Opus to WAV when needed.`, `Map studio job fields to ACE-Step GenerationParams values.  This module has no A`, `Remove gendered / register cues so reference audio can steer timbre.`, `Download ACE-Step checkpoints with visible, resumable progress.  ACE-Step's snap`, `Return True when the file has a non-empty JSON safetensors header.` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (2 nodes): `clip_lyrics()`, `test_clip_lyrics_keeps_complete_sections()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `vocal_language()`, `test_devanagari_language()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `_fmt_gb()`, `_print_resume_state()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_job()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.448) - this node is a cross-community bridge._
- **Why does `load_handlers()` connect `Community 0` to `Community 3`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.423) - this node is a cross-community bridge._
- **Why does `job_to_params()` connect `Community 1` to `Community 2`, `Community 4`, `Community 9`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.305) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `job_to_params()` (e.g. with `run_job()` and `test_allows_five_minute_songs()`) actually correct?**
  _`job_to_params()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `run_job()` (e.g. with `job_to_params()` and `clip_caption()`) actually correct?**
  _`run_job()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `load_handlers()` (e.g. with `ensure_checkpoints()` and `ensure_lm()`) actually correct?**
  _`load_handlers()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Require a readable reference file; convert WebM/Opus to WAV when needed.`, `Map studio job fields to ACE-Step GenerationParams values.  This module has no A`, `Remove gendered / register cues so reference audio can steer timbre.` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._