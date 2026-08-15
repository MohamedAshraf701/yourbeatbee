# YourBeatBee (MusicAI)

Local AI music studio for original songs (Bollywood / Hollywood styles and beyond). **ACE-Step 1.5** runs **on this machine** (MLX / MPS on Apple Silicon). There is no ACE-Step cloud API or remote inference host.

**UI name:** YourBeatBee · **Package:** `musicai`

> **Full documentation:** [docs/PROJECT.md](docs/PROJECT.md) — what it is, architecture, how it was built, how to run, tech stack, APIs, My Voice (RVC), and settings.

## Quick start

```bash
npm install
npm run studio
```

Open [http://localhost:3000](http://localhost:3000). Complete **Setup** in the browser (detect hardware → pick models → install → start engine). Wait until the engine badge shows ready, then create a song.

## Requirements

- macOS Apple Silicon (primary); CUDA / CPU experimental  
- Node.js 20+, [uv](https://docs.astral.sh/uv/)  
- Several GB disk for weights; 16GB+ RAM recommended  
- Optional: `ffmpeg` for MP3 export  

## Optional CLI

```bash
npm run setup:engine
npm run download:models
npm run studio
# or: npm run engine   and   npm run dev
```

## One-line mental model

Studio UI writes jobs to `data/jobs/` → Python `engine/worker.py` loads ACE-Step and writes `data/songs/` → optional RVC “My Voice” after generate.

See [docs/PROJECT.md](docs/PROJECT.md) for details.
