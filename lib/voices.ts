import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  copyFileSync,
} from "node:fs"
import path from "node:path"
import { randomBytes } from "node:crypto"

import { dataPaths, ensureDataDirs } from "@/lib/paths"

export type VoiceProfile = {
  ready: boolean
  kind: "rvc" | null
  filename: string | null
  originalName: string | null
  sizeBytes: number | null
  uploadedAt: string | null
  modelPath: string | null
  indexPath: string | null
  format: string | null
}

type VoiceMeta = {
  kind: "rvc"
  format: string
  filename: string
  indexFilename: string | null
  originalName: string
  sizeBytes: number
  uploadedAt: string
}

const MAX_ZIP_BYTES = 800 * 1024 * 1024
const MAX_PTH_BYTES = 600 * 1024 * 1024

export function voicePaths() {
  const voices = path.join(dataPaths().data, "voices")
  const rvc = path.join(voices, "rvc")
  const modelDir = path.join(rvc, "user")
  return {
    dir: voices,
    rvc,
    modelDir,
    meta: path.join(voices, "profile.json"),
    model: path.join(modelDir, "model.pth"),
    index: path.join(modelDir, "model.index"),
  }
}

function ensureVoiceDir() {
  ensureDataDirs()
  mkdirSync(voicePaths().dir, { recursive: true })
  mkdirSync(voicePaths().rvc, { recursive: true })
  mkdirSync(voicePaths().modelDir, { recursive: true })
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

function readMeta(): VoiceMeta | null {
  try {
    const raw = JSON.parse(readFileSync(voicePaths().meta, "utf8")) as VoiceMeta
    if (raw?.kind !== "rvc" || !raw.filename) {
      return null
    }
    return raw
  } catch {
    return null
  }
}

function clearRvcFiles() {
  const { rvc } = voicePaths()
  if (!existsSync(rvc)) {
    return
  }
  try {
    rmSync(rvc, { recursive: true, force: true })
  } catch {
    // ignore
  }
  mkdirSync(voicePaths().modelDir, { recursive: true })
}

function emptyProfile(): VoiceProfile {
  return {
    ready: false,
    kind: null,
    filename: null,
    originalName: null,
    sizeBytes: null,
    uploadedAt: null,
    modelPath: null,
    indexPath: null,
    format: null,
  }
}

export function getVoiceProfile(): VoiceProfile {
  ensureVoiceDir()
  const meta = readMeta()
  if (!meta) {
    return emptyProfile()
  }
  const modelPath = path.join(voicePaths().rvc, meta.filename)
  if (!existsSync(modelPath)) {
    return emptyProfile()
  }
  const indexPath =
    meta.indexFilename &&
    existsSync(path.join(voicePaths().rvc, meta.indexFilename))
      ? path.join(voicePaths().rvc, meta.indexFilename)
      : null
  return {
    ready: true,
    kind: "rvc",
    filename: meta.filename,
    originalName: meta.originalName,
    sizeBytes: meta.sizeBytes,
    uploadedAt: meta.uploadedAt,
    modelPath,
    indexPath,
    format: meta.format,
  }
}

function findFilesRecursive(dir: string, pred: (name: string) => boolean): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      out.push(...findFilesRecursive(full, pred))
    } else if (pred(name.name)) {
      out.push(full)
    }
  }
  return out
}

function extractZip(zipPath: string, destDir: string): string | null {
  mkdirSync(destDir, { recursive: true })
  const result = spawnSync("unzip", ["-o", "-q", zipPath, "-d", destDir], {
    encoding: "utf8",
  })
  if (result.status !== 0) {
    return result.stderr || result.stdout || "unzip failed"
  }
  return null
}

function detectFormat(pthPath: string): string {
  return "rvc_v2"
}

function finalizeImport(opts: {
  pthSource: string
  indexSource: string | null
  originalName: string
}): VoiceProfile | string {
  const { modelDir, model, index } = voicePaths()
  clearRvcFiles()
  mkdirSync(modelDir, { recursive: true })
  copyFileSync(opts.pthSource, model)
  let indexFilename: string | null = null
  if (opts.indexSource && existsSync(opts.indexSource)) {
    copyFileSync(opts.indexSource, index)
    indexFilename = "user/model.index"
  }

  const meta: VoiceMeta = {
    kind: "rvc",
    format: detectFormat(model),
    filename: "user/model.pth",
    indexFilename,
    originalName: opts.originalName,
    sizeBytes: statSync(model).size,
    uploadedAt: new Date().toISOString(),
  }
  writeAtomic(voicePaths().meta, meta)
  return getVoiceProfile()
}

/** Import an RVC zip (Colab export) or a raw .pth (+ optional .index via form). */
export function saveRvcUpload(file: {
  originalName: string
  buffer: Buffer
  indexBuffer?: Buffer | null
  indexName?: string | null
}): VoiceProfile | string {
  ensureVoiceDir()
  const ext = path.extname(file.originalName).toLowerCase()
  if (ext !== ".zip" && ext !== ".pth") {
    return "Upload an RVC model zip (from Colab) or a .pth file."
  }
  if (file.buffer.byteLength < 1_000_000) {
    return "File looks too small for an RVC model."
  }
  if (ext === ".zip" && file.buffer.byteLength > MAX_ZIP_BYTES) {
    return "Zip must be under 800 MB."
  }
  if (ext === ".pth" && file.buffer.byteLength > MAX_PTH_BYTES) {
    return "Model .pth must be under 600 MB."
  }

  const staging = path.join(
    voicePaths().dir,
    `.import-${randomBytes(6).toString("hex")}`
  )
  mkdirSync(staging, { recursive: true })

  try {
    if (ext === ".zip") {
      const zipPath = path.join(staging, "model.zip")
      writeFileSync(zipPath, file.buffer)
      const err = extractZip(zipPath, staging)
      if (err) {
        return `Could not unzip model: ${err}`
      }
      const pths = findFilesRecursive(staging, (n) => n.toLowerCase().endsWith(".pth"))
      if (pths.length === 0) {
        return "Zip has no .pth file. Export your RVC model and try again."
      }
      // Prefer largest .pth (final weights over tiny checkpoints).
      pths.sort((a, b) => statSync(b).size - statSync(a).size)
      const pthSource = pths[0]!
      const indexes = findFilesRecursive(
        staging,
        (n) => n.toLowerCase().endsWith(".index")
      )
      indexes.sort((a, b) => statSync(b).size - statSync(a).size)
      return finalizeImport({
        pthSource,
        indexSource: indexes[0] ?? null,
        originalName: file.originalName,
      })
    }

    // Raw .pth (+ optional index)
    const pthPath = path.join(staging, "model.pth")
    writeFileSync(pthPath, file.buffer)
    let indexSource: string | null = null
    if (file.indexBuffer && file.indexBuffer.byteLength > 0) {
      const idxName = (file.indexName || "model.index").toLowerCase()
      if (!idxName.endsWith(".index")) {
        return "Index file must end in .index"
      }
      indexSource = path.join(staging, "model.index")
      writeFileSync(indexSource, file.indexBuffer)
    }
    return finalizeImport({
      pthSource: pthPath,
      indexSource,
      originalName: file.originalName,
    })
  } finally {
    try {
      rmSync(staging, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

export function clearVoiceProfile(): void {
  ensureVoiceDir()
  clearRvcFiles()
  // Also clear legacy mic reference files in voices/
  for (const name of readdirSync(voicePaths().dir)) {
    if (name === "rvc" || name === "profile.json" || name.startsWith(".")) {
      continue
    }
    try {
      unlinkSync(path.join(voicePaths().dir, name))
    } catch {
      // ignore
    }
  }
  try {
    unlinkSync(voicePaths().meta)
  } catch {
    // ignore
  }
}
