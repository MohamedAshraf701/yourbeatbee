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
    settings: path.join(root, "data", "settings.json"),
    setupStatus: path.join(root, "data", "setup-status.json"),
    supervisor: path.join(root, "data", "engine-supervisor.json"),
    presence: path.join(root, "data", "studio-presence.json"),
  }
}

export function ensureDataDirs() {
  const { jobs, songs, voices, data } = dataPaths()
  mkdirSync(data, { recursive: true })
  mkdirSync(jobs, { recursive: true })
  mkdirSync(songs, { recursive: true })
  mkdirSync(voices, { recursive: true })
}

export function isSafeId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id)
}
