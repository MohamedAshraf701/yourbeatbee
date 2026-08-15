import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"

import { dataPaths, ensureDataDirs } from "@/lib/paths"
import { listJobs } from "@/lib/jobs"
import { stopEngineProcess } from "@/lib/engine-supervisor"

/** Stop engine if studio tab has been gone this long (ms). */
export const PRESENCE_IDLE_MS = 90_000

type PresenceState = {
  lastSeenAt: string
  clients: number
}

function presencePath() {
  return dataPaths().presence
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

export function touchPresence(): PresenceState {
  ensureDataDirs()
  mkdirSync(dataPaths().data, { recursive: true })
  const next: PresenceState = {
    lastSeenAt: new Date().toISOString(),
    clients: 1,
  }
  writeAtomic(presencePath(), next)
  return next
}

/** Mark UI gone immediately (tab close / pagehide) so auto-stop can run. */
export function leavePresence(): PresenceState {
  ensureDataDirs()
  mkdirSync(dataPaths().data, { recursive: true })
  const next: PresenceState = {
    // Age this past the idle threshold so maybeAutoStopEngine() fires now.
    lastSeenAt: new Date(Date.now() - PRESENCE_IDLE_MS - 1000).toISOString(),
    clients: 0,
  }
  writeAtomic(presencePath(), next)
  return next
}

export function readPresence(): PresenceState | null {
  try {
    return JSON.parse(readFileSync(presencePath(), "utf8")) as PresenceState
  } catch {
    return null
  }
}

export function presenceAgeMs(): number | null {
  const p = readPresence()
  if (!p?.lastSeenAt) {
    return null
  }
  const age = Date.now() - Date.parse(p.lastSeenAt)
  return Number.isFinite(age) ? age : null
}

/** Call from health/presence routes — stop engine when UI is gone and idle. */
export function maybeAutoStopEngine(): {
  stopped: boolean
  reason: string | null
} {
  const age = presenceAgeMs()
  if (age === null) {
    return { stopped: false, reason: null }
  }
  if (age < PRESENCE_IDLE_MS) {
    return { stopped: false, reason: null }
  }

  const active = listJobs().some(
    (j) => j.status === "queued" || j.status === "running"
  )
  if (active) {
    return { stopped: false, reason: "jobs_active" }
  }

  if (!existsSync(dataPaths().engine) && !existsSync(dataPaths().supervisor)) {
    return { stopped: false, reason: null }
  }

  stopEngineProcess()
  return { stopped: true, reason: "studio_idle" }
}
