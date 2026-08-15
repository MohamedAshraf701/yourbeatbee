# MusicAI

Local studio for original songs in Bollywood and Hollywood styles. ACE-Step 1.5 loads **on this Mac** (MLX / MPS). There is no ACE-Step REST API, Hugging Face Space, or cloud inference.

Type a style, paste Hindi or English lyrics (optional), pick male / female / instrumental, then tune style influence and weirdness. Play and download the result from `data/songs/`.

## Requirements

- macOS with Apple Silicon
- Node.js 20+
- [uv](https://docs.astral.sh/uv/) (Python 3.11–3.12)
- Enough disk for model weights (several GB on first run)
- 16GB unified memory recommended (24GB+ if you switch back to the 1.7B LM)
- Optional: `ffmpeg` on PATH for MP3 export (otherwise the engine saves WAV)

## Setup

```bash
npm install
npm run setup:engine
```

`setup:engine` clones [ACE-Step 1.5](https://github.com/ACE-Step/ACE-Step-1.5) into `vendor/ACE-Step-1.5` and runs `uv sync`.

## Run

```bash
npm run studio
```

This starts the Next.js UI and the Python engine together. Open [http://localhost:3000](http://localhost:3000).

Or run them separately:

```bash
npm run engine    # loads ACE-Step into RAM, watches data/jobs/
npm run dev       # studio UI
```

The first run downloads several GB. Use the dedicated downloader so you see a **per-file progress bar** and a size heartbeat every 15s:

```bash
npm run download:models
npm run engine
```

Ctrl+C and re-run is safe — it resumes. Do not leave `HF_HUB_ENABLE_HF_TRANSFER=1`; that mode prints nothing and looks stuck.

Wait until the UI badge shows the device and model name before generating.

## How it works

1. The engine process loads `AceStepHandler` + `LLMHandler` into memory (`device=mps`).
2. The studio writes a job file to `data/jobs/{id}.json`.
3. The engine calls `generate_music(...)` and writes `data/songs/{id}.mp3`.
4. The UI plays and downloads from the local files.

No HTTP calls are made to ACE-Step or any remote model host.

## Controls

| Control | What it does |
|---|---|
| Style | Free-text caption (required if lyrics are empty) |
| Lyrics | Optional Hindi or English. Empty → local LM writes them |
| Voice | Male / female tags in the caption, or instrumental |
| Style influence | `guidance_scale` (how tightly the model follows your style) |
| Weirdness | LM temperature; high values also use SDE sampling |
| Optional chips | Only paste a starting phrase into the style box |

On Apple Silicon the default is `acestep-v15-turbo` + MLX + the **0.6B** LM (fits ~16–24GB unified memory). Fast mode uses fewer diffusion steps. Set `ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-1.7B` only if you have ≥32GB. Set `ACESTEP_CONFIG_PATH=acestep-v15-sft` only if you have ≥20GB and want stronger style influence.

**My Voice:** click **My Voice** → guided mic setup. You sing on-screen lyrics for ~2–3 minutes, review, then save. Stored in `data/voices/` and passed to ACE-Step as `reference_audio` (no per-user training).

## Environment (optional)

| Variable | Default |
|---|---|
| `ACESTEP_CONFIG_PATH` | `acestep-v15-turbo` |
| `ACESTEP_LM_MODEL_PATH` | `acestep-5Hz-lm-0.6B` |
| `ACESTEP_LM_BACKEND` | `mlx` on macOS |
| `ACESTEP_DEVICE` | `mps` when available |
| `ACESTEP_CHECKPOINTS` | `vendor/ACE-Step-1.5/checkpoints` |

To force turbo instead of sft, start the engine with `ACESTEP_CONFIG_PATH=acestep-v15-turbo npm run engine`. Turbo ignores classifier-free guidance.

## License

Studio code is yours to use in this repo. ACE-Step is MIT — see `vendor/ACE-Step-1.5/LICENSE` after setup. Generated audio should be treated as original-with-AI-disclosure; verify originality before commercial release.
