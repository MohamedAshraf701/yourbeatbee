import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"

import { dataPaths, ensureDataDirs, projectRoot } from "@/lib/paths"
import type { DitModelId, EngineFamilyId, LmModelId } from "@/lib/models"

export type SetupStatus = {
  running: boolean
  step: string
  message: string
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  logTail: string
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

export function readSetupStatus(): SetupStatus {
  ensureDataDirs()
  try {
    return JSON.parse(
      readFileSync(dataPaths().setupStatus, "utf8")
    ) as SetupStatus
  } catch {
    return {
      running: false,
      step: "idle",
      message: "Not started",
      error: null,
      startedAt: null,
      finishedAt: null,
      logTail: "",
    }
  }
}

function writeStatus(patch: Partial<SetupStatus>) {
  const current = readSetupStatus()
  writeAtomic(dataPaths().setupStatus, { ...current, ...patch })
}

export function startInstallPipeline(opts: {
  engineFamily?: EngineFamilyId
  ditModel: DitModelId
  lmModel: LmModelId
  /** full = clone/sync + download; models = download weights only */
  mode?: "full" | "models"
}): SetupStatus {
  const current = readSetupStatus()
  if (current.running) {
    return current
  }

  const mode = opts.mode ?? "full"
  const family = opts.engineFamily ?? "ace"
  const root = projectRoot()
  const logPath = path.join(dataPaths().data, "setup.log")
  mkdirSync(dataPaths().data, { recursive: true })
  writeFileSync(logPath, "", { flag: "a" })

  const isHeart = family === "heartmula"
  writeStatus({
    running: true,
    step: mode === "models" ? "download" : "install",
    message: isHeart
      ? mode === "models"
        ? "Downloading HeartMuLa 3B + HeartCodec…"
        : "Installing HeartMuLa heartlib and downloading weights…"
      : mode === "models"
        ? `Downloading ${opts.ditModel} + ${opts.lmModel}…`
        : "Installing ACE-Step, RVC env, and downloading models…",
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logTail: "",
  })

  const script = isHeart
    ? mode === "models"
      ? `
set -euo pipefail
ROOT="${root}"
cd "$ROOT"
echo "[setup] Downloading HeartMuLa weights…"
bash scripts/download-heartmula.sh
echo "[setup] Done."
`
      : `
set -euo pipefail
ROOT="${root}"
cd "$ROOT"
echo "[setup] HeartMuLa heartlib…"
bash scripts/setup-heartmula.sh
echo "[setup] Downloading HeartMuLa weights…"
bash scripts/download-heartmula.sh
echo "[setup] Done."
`
    : mode === "models"
      ? `
set -euo pipefail
ROOT="${root}"
cd "$ROOT"
echo "[setup] Downloading DiT checkpoints + LM ${opts.lmModel}…"
export ACESTEP_LM_MODEL_PATH="${opts.lmModel}"
export ACESTEP_CONFIG_PATH="${opts.ditModel}"
bash scripts/download-models.sh
echo "[setup] Done."
`
      : `
set -euo pipefail
ROOT="${root}"
cd "$ROOT"
echo "[setup] ACE-Step / RVC…"
bash scripts/setup-engine.sh
echo "[setup] Downloading DiT checkpoints + LM ${opts.lmModel}…"
export ACESTEP_LM_MODEL_PATH="${opts.lmModel}"
export ACESTEP_CONFIG_PATH="${opts.ditModel}"
bash scripts/download-models.sh
echo "[setup] Done."
`

  const fd = openSync(logPath, "a")
  const child = spawn("bash", ["-lc", script], {
    cwd: root,
    detached: true,
    stdio: ["ignore", fd, fd],
    env: {
      ...process.env,
      ACESTEP_LM_MODEL_PATH: opts.lmModel,
      ACESTEP_CONFIG_PATH: opts.ditModel,
    },
  })
  child.unref()

  child.on("exit", (code) => {
    let logTail = ""
    try {
      const full = readFileSync(logPath, "utf8")
      logTail = full.slice(-4000)
    } catch {
      // ignore
    }
    if (code === 0) {
      writeStatus({
        running: false,
        step: "done",
        message: "Install finished. You can start the engine.",
        error: null,
        finishedAt: new Date().toISOString(),
        logTail,
      })
    } else {
      writeStatus({
        running: false,
        step: "error",
        message: "Install failed",
        error: `Setup exited with code ${code}`,
        finishedAt: new Date().toISOString(),
        logTail,
      })
    }
  })

  const timer = setInterval(() => {
    const st = readSetupStatus()
    if (!st.running) {
      clearInterval(timer)
      return
    }
    try {
      const full = readFileSync(logPath, "utf8")
      writeStatus({ logTail: full.slice(-4000) })
    } catch {
      // ignore
    }
  }, 2000)

  return readSetupStatus()
}

export function vendorInstalled(): boolean {
  const vendor = path.join(projectRoot(), "vendor", "ACE-Step-1.5")
  return (
    existsSync(path.join(vendor, "pyproject.toml")) ||
    existsSync(path.join(vendor, ".git"))
  )
}

export function heartmulaInstalled(): boolean {
  const heart = path.join(projectRoot(), "vendor", "heartlib")
  const ckpt = path.join(heart, "ckpt")
  return (
    (existsSync(path.join(heart, "pyproject.toml")) ||
      existsSync(path.join(heart, ".git"))) &&
    existsSync(path.join(ckpt, "HeartMuLa-oss-3B")) &&
    existsSync(path.join(ckpt, "HeartCodec-oss"))
  )
}
