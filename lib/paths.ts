import { mkdirSync } from "node:fs"
import path from "node:path"

export function projectRoot() {
  return process.cwd()
}

export function dataPaths() {
  const root = projectRoot()
  return {
    root,
    data: path.join(root, "data"),
    jobs: path.join(root, "data", "jobs"),
    songs: path.join(root, "data", "songs"),
    voices: path.join(root, "data", "voices"),
    engine: path.join(root, "data", "engine.json"),
  }
}

export function ensureDataDirs() {
  const { jobs, songs, voices } = dataPaths()
  mkdirSync(jobs, { recursive: true })
  mkdirSync(songs, { recursive: true })
  mkdirSync(voices, { recursive: true })
}

export function isSafeId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id)
}
