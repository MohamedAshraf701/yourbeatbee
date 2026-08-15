# YourBeatBee (MusicAI) — Project Documentation

**Product name in the UI:** YourBeatBee  
**Repository / package name:** `musicai`  
**Version:** 0.0.1  

This document explains what the project is, how it works, how it was built, how to run it, and which technologies it uses.

---

## Table of contents

1. [What is this project?](#1-what-is-this-project)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [How it works](#3-how-it-works)
4. [Architecture](#4-architecture)
5. [How it was created](#5-how-it-was-created)
6. [Tech stack](#6-tech-stack)
7. [Repository layout](#7-repository-layout)
8. [Requirements](#8-requirements)
9. [How to run](#9-how-to-run)
10. [Studio features](#10-studio-features)
11. [My Voice (RVC)](#11-my-voice-rvc)
12. [Setup, models, and settings](#12-setup-models-and-settings)
13. [Data on disk](#13-data-on-disk)
14. [API reference (local)](#14-api-reference-local)
15. [Environment variables](#15-environment-variables)
16. [Scripts](#16-scripts)
17. [Development notes](#17-development-notes)
18. [License and disclosure](#18-license-and-disclosure)

---

## 1. What is this project?

**YourBeatBee** is a **local AI music studio**. You type a song idea (style / mood), paste lyrics, pick a voice, and generate an original track **on your own machine**.

It is built around **[ACE-Step 1.5](https://github.com/ACE-Step/ACE-Step-1.5)** — an open-source text-to-music model. On Apple Silicon it typically runs with **MLX** / **MPS**. There is:

- **No** ACE-Step cloud REST API  
- **No** Hugging Face Space as the inference host  
- **No** remote “generate song” service  

Weights download once (Hugging Face Hub), then inference stays local. The Next.js app is a studio UI that queues jobs as JSON files; a Python worker loads the model into RAM and processes those jobs.

**Primary use cases**

- Bollywood / Hollywood–style original songs from a text prompt + lyrics  
- Male / female / instrumental vocals from ACE-Step  
- **My Voice:** import a personal **RVC** singing model (trained elsewhere, e.g. Colab) and convert lead vocals after generation  

---

## 2. Goals and non-goals

### Goals

- One command for open-source users: install Node deps → `npm run studio` → finish **Setup** in the browser  
- Detect hardware and recommend DiT + LM sizes  
- Persist choices in `data/settings.json`  
- Change models later from the UI and restart the engine  
- Optional **My Voice** via imported RVC models  

### Non-goals

- Training RVC on the Mac inside the app  
- Instant voice clone from a short mic sample (ACE-Step reference audio is not true speaker cloning)  
- Packaged `.app` / zero-Node installer (not in scope yet)  
- Multi-user cloud hosting  

---

## 3. How it works

End-to-end flow:

```text
┌─────────────────┐     JSON job      ┌──────────────────────┐
│  Next.js studio │ ───────────────►  │  Python engine       │
│  (browser UI)   │   data/jobs/      │  engine/worker.py    │
│                 │ ◄───────────────  │  ACE-Step + optional │
│  play / download│   data/songs/     │  Demucs + RVC        │
└─────────────────┘                   └──────────────────────┘
```

### Step by step

1. **Studio UI** (`npm run dev` / `npm run studio`) runs at [http://localhost:3000](http://localhost:3000).
2. User fills **Idea**, **Lyrics**, **Voice**, **Song DNA** (style lock, weirdness, tempo, etc.), then **Create the song**.
3. `POST /api/generate` validates input and writes `data/jobs/{id}.json` with `status: "queued"`.
4. **Engine** (`engine/worker.py`) already has ACE-Step DiT + LM loaded. It polls `data/jobs/`, picks queued jobs, maps fields to ACE-Step `GenerationParams` (`engine/compose.py`), and calls `generate_music(...)`.
5. Audio is written under `data/songs/` (MP3 if `ffmpeg` exists, else WAV) plus a song metadata JSON.
6. If voice is **My Voice (custom)** and an RVC model is imported: after ACE-Step finishes, the engine **separates** stems (Demucs), **converts** vocals with RVC, **remixes**, and overwrites the song file.
7. UI polls `GET /api/jobs/{id}` and `/api/health`, then plays via `GET /api/songs/{id}/audio`.

### Heartbeat and progress

- Engine writes `data/engine.json` (ready / phase / progress / device / LM).  
- Jobs include `phase`, `progress`, `message` so the UI can show Melody → Rhythm → Vocals → Mix.  
- Closing the studio tab stops presence pings; after ~90s idle (and no active jobs) the engine **unloads** to free RAM.

---

## 4. Architecture

```text
Browser (YourBeatBee UI)
    │
    ▼
Next.js App Router  ──►  lib/* (jobs, songs, settings, voices, supervisor)
    │                         │
    │                         ├── data/settings.json
    │                         ├── data/jobs/*.json
    │                         ├── data/songs/*
    │                         └── data/voices/rvc/*
    │
    └── Engine supervisor (Node) can start/stop/restart
            │
            ▼
        scripts/start-engine.sh
            │
            ▼
        uv run python engine/worker.py
            │
            ├── vendor/ACE-Step-1.5  (DiT + LM)
            └── vendor/rvc-env      (Demucs + rvc-python, Python 3.10)
```

### Important modules

| Area | Path | Role |
|------|------|------|
| UI shell | `components/studio.tsx`, `components/studio/*` | Create / Library / Voices / Engine views |
| Setup wizard | `components/setup-wizard.tsx` | First-run detect → models → install → start |
| Engine settings | `components/studio/engine-settings.tsx` | DiT/LM pick, apply & restart |
| Job API | `app/api/generate`, `app/api/jobs` | Queue and poll generations |
| Health | `app/api/health` | Engine + settings + recommendations |
| Setup APIs | `app/api/setup/*` | System probe, settings, install, engine control, presence |
| Voice API | `app/api/voice` | Import / clear RVC model |
| Worker | `engine/worker.py` | Load models, run jobs, heartbeat |
| Compose | `engine/compose.py` | Map studio fields → ACE-Step params |
| RVC | `engine/voice_convert.py`, `engine/rvc_cli.py` | Post-generate voice conversion |
| Settings | `lib/settings.ts`, `engine/settings_loader.py` | Shared `data/settings.json` |
| Recommendations | `lib/models.ts` | Hardware → DiT/LM table |

---

## 5. How it was created

High-level build history (conceptual):

1. **Scaffold** a Next.js App Router app (React 19, Tailwind 4, TypeScript) as the studio shell.  
2. **Vendor ACE-Step 1.5** under `vendor/ACE-Step-1.5` via `scripts/setup-engine.sh` (`git clone` + `uv sync`).  
3. **Python worker** watches a local job folder instead of calling a remote API — file-based IPC is simple and works offline.  
4. **Compose layer** translates UI knobs (influence, weirdness, voice, duration, BPM) into ACE-Step generation parameters.  
5. **Download helpers** pull DiT / LM weights with visible progress (avoid silent `hf_transfer`).  
6. **Frontend redesign** into YourBeatBee: Create / Library / Voices / Engine, local-first branding.  
7. **Browser-first setup:** hardware probe, model recommendations, install pipeline, engine supervisor from the UI.  
8. **My Voice:** RVC import path + Demucs separate → RVC convert → remix (true singer identity; not ACE-Step “style reference”).  
9. **Ops polish:** heartbeat during load/generate, stop/unload, auto-stop when the studio tab is gone.

---

## 6. Tech stack

### Frontend / app server

| Tech | Version (approx.) | Use |
|------|-------------------|-----|
| **Next.js** | 16.x | App Router, API routes, studio UI |
| **React** | 19.x | UI components |
| **TypeScript** | 5.x | Types across app + lib |
| **Tailwind CSS** | 4.x | Styling / design tokens |
| **shadcn/ui** + **Base UI** | — | Dialogs, buttons, primitives |
| **lucide-react** | — | Icons |
| **sonner** | — | Toasts |
| **next-themes** | — | Light / dark |
| **concurrently** | — | Run web + engine together |

### Local AI / audio (Python)

| Tech | Use |
|------|-----|
| **Python** | 3.11–3.12 for ACE-Step (`uv`); **3.10** for RVC env |
| **uv** | Dependency sync / run for ACE-Step |
| **ACE-Step 1.5** | Text-to-music (DiT + language model) |
| **MLX / PyTorch** | LM backend (`mlx` on Mac, `pt` elsewhere) |
| **MPS / CUDA / CPU** | Device for DiT |
| **Demucs** | Vocal / instrumental stem separation |
| **rvc-python** | RVC inference (My Voice) |
| **ffmpeg** (optional) | MP3 export; WAV if missing |
| **Hugging Face Hub** | One-time weight download |

### Persistence

- JSON files under `data/` (no required database)  
- Settings, jobs, songs, engine heartbeat, presence, RVC profiles  

---

## 7. Repository layout

```text
musicai/
├── app/                    # Next.js routes + API
│   ├── api/
│   │   ├── generate/
│   │   ├── health/
│   │   ├── jobs/
│   │   ├── songs/
│   │   ├── voice/
│   │   └── setup/          # system, settings, install, status, engine, presence
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── studio.tsx          # Main studio controller
│   ├── studio/             # Create, library, voices, engine UI pieces
│   ├── setup-wizard.tsx
│   ├── settings-panel.tsx
│   ├── voice-setup.tsx
│   └── ui/                 # shadcn primitives
├── lib/                    # Shared TS: jobs, songs, settings, models, supervisor…
├── engine/                 # Python worker + compose + download + RVC
├── scripts/                # setup-engine, setup-rvc, start-engine, download-models
├── vendor/                 # ACE-Step-1.5, rvc-env (created by setup)
├── data/                   # Runtime: jobs, songs, voices, settings (local)
├── docs/                   # Documentation (this file)
├── package.json
└── README.md               # Short quick start
```

---

## 8. Requirements

| Requirement | Notes |
|-------------|--------|
| **macOS Apple Silicon** | Primary target (MLX / MPS) |
| **Node.js 20+** | Studio + APIs |
| **uv** | [https://docs.astral.sh/uv/](https://docs.astral.sh/uv/) |
| **Disk** | Several GB for ACE-Step + LM weights |
| **RAM** | 16GB+ unified memory recommended; Setup recommends 0.6B vs 1.7B |
| **ffmpeg** | Optional; improves MP3 export |
| **CUDA** | Experimental for ACE-Step; **needed to train** RVC (e.g. Colab), not to run conversion on Mac |

---

## 9. How to run

### Recommended (open source)

```bash
git clone <your-repo-url> musicai
cd musicai
npm install
npm run studio
```

1. Open [http://localhost:3000](http://localhost:3000).  
2. Complete the **Setup** wizard (detect hardware → pick DiT/LM → install → start engine).  
3. Wait until the engine badge shows **Local** / ready (device + LM).  
4. Create a song on the **Create** tab.

`npm run studio` starts:

- Next.js dev server (`npm run dev`)  
- Python engine (`npm run engine`)  

### Optional CLI-only setup

```bash
npm run setup:engine      # clone ACE-Step, uv sync, setup RVC env
npm run download:models   # download weights with progress bars
npm run studio
```

Or split processes:

```bash
npm run engine    # terminal A — loads models, watches data/jobs/
npm run dev       # terminal B — UI only
```

### Useful commands

```bash
npm run setup:rvc           # RVC / Demucs env only
npm run download:models     # resume-safe weight download
npm run typecheck           # TypeScript
npm run lint
npm run format
```

### First-run tips

- First download can take a long time; progress should appear file-by-file.  
- Do **not** enable `HF_HUB_ENABLE_HF_TRANSFER=1` — it often looks “stuck” with no logs.  
- Ctrl+C and re-run downloads are safe (resumable).  
- Generate only after the UI shows the engine ready.

---

## 10. Studio features

### Create

| Control | Maps to |
|---------|---------|
| Idea (style) | Caption / prompt for ACE-Step |
| Lyrics | Singing lyrics (Hindi / English); structure tags like `[Verse]` optional |
| Voice | `female` / `male` / `instrumental` / `custom` (My Voice) |
| Language | `auto` / `hi` / `en` |
| Duration | 30s / 1m / 2m / 5m / auto |
| Style lock | `influence` → guidance / LM CFG |
| Weirdness | LM temperature; high values → SDE sampling |
| Tempo | Optional BPM |
| Advanced | Seed, Quality vs Fast (fewer diffusion steps) |

### Library

Saved songs from `data/songs/` — search, filter, detail, play, download.

### Voices

Import / replace / remove RVC model; **Voice Identity** strength (RVC mix strength).

### Engine

Hardware-aware model pick, download missing weights, apply & restart, stop/unload, first-run wizard.

---

## 11. My Voice (RVC)

ACE-Step does **not** clone your real singing identity from a short mic clip. For true “my voice”:

1. Record ~10–15 minutes of clean solo singing.  
2. Train an **RVC v2** model on Colab / RVC WebUI (CUDA).  
3. Download the export zip (`.pth` + usually `.index`).  
4. In the studio: **Import Voice**.  
5. Generate with **My Voice** selected.

**Pipeline after ACE-Step:**

```text
Full mix → Demucs (vocals | instrumental) → RVC on vocals → remix → save
```

Assets live under `data/voices/rvc/` and `data/models/rvc/` (HuBERT / RMVPE). Conversion needs `vendor/rvc-env` (from setup).

---

## 12. Setup, models, and settings

### Settings file

`data/settings.json` stores:

- `setupComplete`, `ditModel`, `lmModel`, `backend`, `device`, `saveMemory`  
- Snapshot of first-run `recommended`  
- `updatedAt`  

The worker reads this file; **environment variables override** when already set.

### Recommendation table (single source: `lib/models.ts`)

| Detected | Suggest DiT | Suggest LM |
|----------|-------------|------------|
| MPS, RAM &lt; 24GB | Turbo | 0.6B |
| MPS, 24–31GB | Turbo | 0.6B (1.7B = advanced) |
| MPS, ≥ 32GB | Turbo | 1.7B |
| CUDA, VRAM ≥ 16GB | Turbo | 1.7B |
| CUDA low VRAM / CPU | Turbo | 0.6B |

Common IDs:

- DiT: `acestep-v15-turbo`, `acestep-v15-sft`  
- LM: `acestep-5Hz-lm-0.6B`, `acestep-5Hz-lm-1.7B`, `acestep-5Hz-lm-4B`  

---

## 13. Data on disk

| Path | Purpose |
|------|---------|
| `data/jobs/*.json` | Generation queue / status / progress |
| `data/songs/*` | Audio + song metadata |
| `data/voices/rvc/` | Imported RVC model + profile |
| `data/models/rvc/` | Shared RVC base assets |
| `data/settings.json` | User model / device preferences |
| `data/engine.json` | Engine heartbeat for the UI |
| `data/engine-supervisor.json` | Node start/stop tracking |
| `data/studio-presence.json` | UI alive ping (auto-unload) |
| `data/setup-status.json` | Install pipeline status |
| `vendor/ACE-Step-1.5/` | Cloned model code + checkpoints |
| `vendor/rvc-env/` | Isolated Python 3.10 for RVC |

`data/` and `vendor/` are local runtime artifacts; keep them out of git as configured in `.gitignore`.

---

## 14. API reference (local)

All routes are local to the Next.js server (no public cloud inference).

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/generate` | Queue a song (requires engine ready) |
| `GET` | `/api/jobs/{id}` | Job status + song when done |
| `GET` | `/api/songs` | List library |
| `GET` | `/api/songs/{id}/audio` | Stream / download audio |
| `GET` / `POST` / `DELETE` | `/api/voice` | RVC profile / import / clear |
| `GET` | `/api/health` | Engine + settings + system + needsSetup |
| `GET` | `/api/setup/system` | Hardware probe + recommendation |
| `GET` / `PUT` | `/api/setup/settings` | Read / write settings |
| `POST` | `/api/setup/install` | Full install or models-only download |
| `GET` | `/api/setup/status` | Install progress |
| `POST` | `/api/setup/engine` | `{ action: "start" \| "stop" \| "restart" \| "unload" }` |
| `POST` | `/api/setup/presence` | Studio tab heartbeat |

---

## 15. Environment variables

Optional power-user overrides (win over `data/settings.json` when set):

| Variable | Meaning |
|----------|---------|
| `ACESTEP_CONFIG_PATH` | DiT id (e.g. `acestep-v15-turbo`) |
| `ACESTEP_LM_MODEL_PATH` | LM id |
| `ACESTEP_LM_BACKEND` | `mlx` or `pt` |
| `ACESTEP_DEVICE` | `mps` / `cuda` / `cpu` |
| `ACESTEP_CHECKPOINTS` | Checkpoint directory |
| `ACESTEP_SAVE_MEMORY` | `1` / `0` |

---

## 16. Scripts

| npm script | Shell / action |
|------------|----------------|
| `studio` | Dev UI + engine together |
| `dev` | Next.js only |
| `engine` | `scripts/start-engine.sh` |
| `setup:engine` | Clone ACE-Step, `uv sync`, setup RVC |
| `setup:rvc` | Python 3.10 RVC env + assets |
| `download:models` | Download DiT/LM with progress |
| `repair:text-encoder` | Repair helper for text encoder weights |

---

## 17. Development notes

- Prefer reading `docs/PROJECT.md` + `README.md` before changing architecture.  
- This Next.js version may differ from older tutorials — check `node_modules/next/dist/docs/` and `AGENTS.md` if present.  
- After structural code changes, keep the graphify knowledge graph updated if you use it (`graphify update .`).  
- Engine must stay running for generate; the UI can start/stop it via Setup APIs.  
- Memory on 16–24GB Macs is tight: prefer Turbo + 0.6B and shorter durations.

### Typical generate path (code)

1. UI → `POST /api/generate` → `lib/jobs.createJob`  
2. Worker → `run_job` → `job_to_params` → `generate_music`  
3. Optional → `apply_rvc_to_song`  
4. Write song JSON + audio → UI poll → Now Playing  

---

## 18. License and disclosure

- **Studio / YourBeatBee app code** in this repo: project-owned (follow your repo license).  
- **ACE-Step:** MIT — see `vendor/ACE-Step-1.5/LICENSE` after setup.  
- **Generated audio:** treat as AI-assisted original work; verify originality and rights before commercial release.  
- **RVC models** you import are your responsibility (training data consent, likeness rights).

---

## Brand assets

Light / dark logos and banners live in `public/brand/`:

| File | Use |
|------|-----|
| `logo-mark-light.png` / `logo-mark-dark.png` | Nav mark; album-art center logo (dark mark) |
| `logo-wordmark-light.png` / `logo-wordmark-dark.png` | Optional wordmark assets |
| `banner-light.png` / `banner-dark.png` | **Open Graph / Twitter / Facebook** share cards only (not in-app hero) |
| `favicon-source.png` | Browser favicon |

In-app: `BrandLogo` in the nav. Album covers use the mark inside the center ring (`SongArtwork`). Social previews use banners via `metadata.openGraph` / `metadata.twitter` in `app/layout.tsx`. Set `NEXT_PUBLIC_SITE_URL` in production so absolute OG URLs resolve correctly.

---

## Quick mental model

> **YourBeatBee = local studio UI + file-based job queue + ACE-Step in Python RAM (+ optional RVC after).**  
> Clone → `npm install` → `npm run studio` → Setup in browser → Create songs on this Mac.

For a shorter quick start, see the root [`README.md`](../README.md).
