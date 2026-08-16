import { randomUUID } from "node:crypto"
import { readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs"
import path from "node:path"

import { dataPaths, ensureDataDirs, isSafeId } from "@/lib/paths"
import { getSettings } from "@/lib/settings"
import type { GenerateInput, Job } from "@/lib/types"

function jobPath(id: string) {
  return path.join(dataPaths().jobs, `${id}.json`)
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

export function validateGenerateInput(body: unknown): GenerateInput | string {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body"
  }
  const input = body as Record<string, unknown>
  const style = typeof input.style === "string" ? input.style.trim() : ""
  const lyrics = typeof input.lyrics === "string" ? input.lyrics : ""
  if (!style && !lyrics.trim()) {
    return "Enter a style, lyrics, or both."
  }

  const voice = input.voice
  if (
    voice !== "male" &&
    voice !== "female" &&
    voice !== "instrumental" &&
    voice !== "custom"
  ) {
    return "Voice must be male, female, instrumental, or custom."
  }

  const language = input.language ?? "auto"
  if (language !== "auto" && language !== "hi" && language !== "en") {
    return "Language must be auto, hi, or en."
  }

  const influence = Number(input.influence ?? 50)
  const weirdness = Number(input.weirdness ?? 30)
  const voiceStrength = Number(input.voiceStrength ?? 75)
  if (!Number.isFinite(influence) || influence < 0 || influence > 100) {
    return "Style influence must be 0–100."
  }
  if (!Number.isFinite(weirdness) || weirdness < 0 || weirdness > 100) {
    return "Weirdness must be 0–100."
  }
  if (
    !Number.isFinite(voiceStrength) ||
    voiceStrength < 0 ||
    voiceStrength > 100
  ) {
    return "Voice strength must be 0–100."
  }

  const duration = Number(input.duration ?? 30)
  if (![30, 60, 120, 300, -1].includes(duration)) {
    return "Duration must be 30, 60, 120, 300, or -1 (auto)."
  }

  let bpm: number | null = null
  if (input.bpm !== null && input.bpm !== undefined && input.bpm !== "") {
    bpm = Number(input.bpm)
    if (!Number.isInteger(bpm) || bpm < 30 || bpm > 300) {
      return "BPM must be between 30 and 300."
    }
  }

  const seed =
    input.seed === undefined || input.seed === "" ? -1 : Number(input.seed)
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    return "Seed must be an integer."
  }

  const settings = getSettings()

  return {
    style,
    lyrics,
    voice,
    language,
    influence,
    weirdness,
    duration,
    bpm,
    seed,
    fast: Boolean(input.fast),
    voiceStrength,
    referenceAudio: null,
    rvcModelPath: null,
    rvcIndexPath: null,
    engineFamily: settings.engineFamily,
  }
}

export function createJob(input: GenerateInput): Job {
  ensureDataDirs()
  const now = new Date().toISOString()
  const job: Job = {
    ...input,
    engineFamily: input.engineFamily || getSettings().engineFamily,
    id: randomUUID(),
    status: "queued",
    progress: 0,
    phase: "queued",
    message: "Waiting for the local engine…",
    createdAt: now,
    updatedAt: now,
  }
  writeAtomic(jobPath(job.id), job)
  return job
}

export function getJob(id: string): Job | null {
  if (!isSafeId(id)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(jobPath(id), "utf8")) as Job
  } catch {
    return null
  }
}

export function listJobs(): Job[] {
  ensureDataDirs()
  return readdirSync(dataPaths().jobs)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(
          readFileSync(path.join(dataPaths().jobs, name), "utf8")
        ) as Job
      } catch {
        return null
      }
    })
    .filter((job): job is Job => Boolean(job))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
