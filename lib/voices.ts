import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import { dataPaths, ensureDataDirs } from "@/lib/paths"

export type VoiceProfile = {
  ready: boolean
  filename: string | null
  originalName: string | null
  sizeBytes: number | null
  uploadedAt: string | null
  absolutePath: string | null
}

type VoiceMeta = {
  filename: string
  originalName: string
  sizeBytes: number
  uploadedAt: string
}

const ALLOWED_EXT = new Set([
  ".wav",
  ".mp3",
  ".flac",
  ".m4a",
  ".ogg",
  ".aac",
  ".webm",
])

export function voicePaths() {
  const voices = path.join(dataPaths().data, "voices")
  return {
    dir: voices,
    meta: path.join(voices, "profile.json"),
  }
}

function ensureVoiceDir() {
  ensureDataDirs()
  mkdirSync(voicePaths().dir, { recursive: true })
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

function readMeta(): VoiceMeta | null {
  try {
    return JSON.parse(readFileSync(voicePaths().meta, "utf8")) as VoiceMeta
  } catch {
    return null
  }
}

function clearAudioFiles() {
  for (const name of readdirSync(voicePaths().dir)) {
    if (name === "profile.json" || name.endsWith(".tmp")) {
      continue
    }
    try {
      unlinkSync(path.join(voicePaths().dir, name))
    } catch {
      // ignore
    }
  }
}

/** Prefer WAV so ACE-Step / soundfile can load the mic recording reliably. */
function convertToWav(inputPath: string, outputPath: string): boolean {
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-ac", "1", "-ar", "48000", outputPath],
    { encoding: "utf8" }
  )
  return result.status === 0 && existsSync(outputPath)
}

export function isAllowedVoiceFilename(name: string) {
  const ext = path.extname(name).toLowerCase()
  return ALLOWED_EXT.has(ext)
}

export function getVoiceProfile(): VoiceProfile {
  ensureVoiceDir()
  const meta = readMeta()
  if (!meta?.filename) {
    return {
      ready: false,
      filename: null,
      originalName: null,
      sizeBytes: null,
      uploadedAt: null,
      absolutePath: null,
    }
  }
  const absolutePath = path.join(voicePaths().dir, meta.filename)
  if (!existsSync(absolutePath)) {
    return {
      ready: false,
      filename: null,
      originalName: null,
      sizeBytes: null,
      uploadedAt: null,
      absolutePath: null,
    }
  }
  return {
    ready: true,
    filename: meta.filename,
    originalName: meta.originalName,
    sizeBytes: meta.sizeBytes,
    uploadedAt: meta.uploadedAt,
    absolutePath,
  }
}

export function saveVoiceUpload(file: {
  originalName: string
  buffer: Buffer
}): VoiceProfile | string {
  ensureVoiceDir()
  const ext = path.extname(file.originalName).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return "Use WAV, MP3, FLAC, M4A, OGG, AAC, or WebM."
  }
  if (file.buffer.byteLength < 20_000) {
    return "Recording is too short. Sing for about 2–3 minutes."
  }
  if (file.buffer.byteLength > 80 * 1024 * 1024) {
    return "Voice file must be under 80 MB."
  }

  clearAudioFiles()

  const rawName = `upload${ext}`
  const rawPath = path.join(voicePaths().dir, rawName)
  writeFileSync(rawPath, file.buffer)

  let filename = rawName
  let absolutePath = rawPath

  if (ext !== ".wav") {
    const wavPath = path.join(voicePaths().dir, "reference.wav")
    if (convertToWav(rawPath, wavPath)) {
      try {
        unlinkSync(rawPath)
      } catch {
        // keep raw if delete fails
      }
      filename = "reference.wav"
      absolutePath = wavPath
    } else {
      // Keep the browser recording; engine will try to convert later.
      filename = `reference${ext}`
      const fallback = path.join(voicePaths().dir, filename)
      renameSync(rawPath, fallback)
      absolutePath = fallback
    }
  } else {
    filename = "reference.wav"
    absolutePath = path.join(voicePaths().dir, filename)
    renameSync(rawPath, absolutePath)
  }

  const meta: VoiceMeta = {
    filename,
    originalName: file.originalName,
    sizeBytes: statSync(absolutePath).size,
    uploadedAt: new Date().toISOString(),
  }
  writeAtomic(voicePaths().meta, meta)
  return getVoiceProfile()
}

export function clearVoiceProfile(): void {
  ensureVoiceDir()
  clearAudioFiles()
  try {
    unlinkSync(voicePaths().meta)
  } catch {
    // ignore
  }
}
