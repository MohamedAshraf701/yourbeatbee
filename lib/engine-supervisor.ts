import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { spawn, execSync, type ChildProcess } from "node:child_process"
import path from "node:path"

import { dataPaths, ensureDataDirs, projectRoot } from "@/lib/paths"
import { getSettings } from "@/lib/settings"

export type SupervisorState = {
  pid: number | null
  startedAt: string | null
  status: "stopped" | "starting" | "running" | "error"
  error: string | null
}

let child: ChildProcess | null = null

function holdPath() {
  return path.join(dataPaths().data, "engine-hold")
}

function studioManagedPath() {
  return path.join(dataPaths().data, "studio-managed")
}

/** True when `npm run studio` owns the engine via engine-loop.sh. */
export function isStudioManagedProcess(): boolean {
  const marker = studioManagedPath()
  if (!existsSync(marker)) return false
  try {
    const pid = Number(readFileSync(marker, "utf8").trim())
    if (!Number.isFinite(pid) || pid <= 0) return false
    return isPidAlive(pid)
  } catch {
    return false
  }
}

function setEngineHold(held: boolean) {
  ensureDataDirs()
  const file = holdPath()
  if (held) {
    writeFileSync(file, `${new Date().toISOString()}\n`, "utf8")
  } else if (existsSync(file)) {
    try {
      unlinkSync(file)
    } catch {
      // ignore
    }
  }
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

function readState(): SupervisorState {
  ensureDataDirs()
  try {
    return JSON.parse(
      readFileSync(dataPaths().supervisor, "utf8")
    ) as SupervisorState
  } catch {
    return {
      pid: null,
      startedAt: null,
      status: "stopped",
      error: null,
    }
  }
}

function writeState(state: SupervisorState) {
  ensureDataDirs()
  writeAtomic(dataPaths().supervisor, state)
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function getEngineSupervisorStatus(): SupervisorState & {
  alive: boolean
} {
  const state = readState()
  const alive = Boolean(state.pid && isPidAlive(state.pid))
  if (state.pid && !alive && state.status === "running") {
    const next: SupervisorState = {
      ...state,
      pid: null,
      status: "stopped",
    }
    writeState(next)
    return { ...next, alive: false }
  }
  return { ...state, alive }
}

export function stopEngineProcess(): SupervisorState {
  // Under npm run studio, hold the loop so it does not immediately respawn.
  if (isStudioManagedProcess()) {
    setEngineHold(true)
  }

  if (child && !child.killed) {
    try {
      child.kill("SIGTERM")
    } catch {
      // ignore
    }
    child = null
  }
  const state = readState()
  if (state.pid && isPidAlive(state.pid)) {
    try {
      process.kill(state.pid, "SIGTERM")
    } catch {
      try {
        process.kill(state.pid, "SIGKILL")
      } catch {
        // ignore
      }
    }
  }
  // Prefer the shared kill script (pidfile + pkill + heartbeat clear).
  try {
    const script = path.join(projectRoot(), "scripts", "kill-engine.sh")
    execSync(`bash "${script}"`, {
      stdio: "ignore",
      timeout: 15_000,
    })
  } catch {
    try {
      execSync("pkill -f '[e]ngine/worker.py' || true", {
        stdio: "ignore",
        timeout: 5000,
      })
    } catch {
      // ignore
    }
  }
  const next: SupervisorState = {
    pid: null,
    startedAt: null,
    status: "stopped",
    error: null,
  }
  writeState(next)
  return next
}

export function startEngineProcess(): SupervisorState {
  setEngineHold(false)

  const existing = getEngineSupervisorStatus()
  if (existing.alive && existing.pid) {
    return {
      pid: existing.pid,
      startedAt: existing.startedAt,
      status: "running",
      error: null,
    }
  }

  // Studio's engine-loop will respawn; avoid a second detached worker.
  if (isStudioManagedProcess()) {
    const next: SupervisorState = {
      pid: null,
      startedAt: new Date().toISOString(),
      status: "starting",
      error: null,
    }
    writeState(next)
    return next
  }

  const root = projectRoot()
  const script = path.join(root, "scripts", "start-engine.sh")
  if (!existsSync(script)) {
    const err: SupervisorState = {
      pid: null,
      startedAt: null,
      status: "error",
      error: "start-engine.sh missing",
    }
    writeState(err)
    return err
  }

  getSettings()
  mkdirSync(dataPaths().data, { recursive: true })
  const logPath = path.join(dataPaths().data, "engine.log")
  const fd = openSync(logPath, "a")

  child = spawn("bash", [script], {
    cwd: root,
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...process.env },
  })
  child.unref()

  const pid = child.pid ?? null
  const next: SupervisorState = {
    pid,
    startedAt: new Date().toISOString(),
    status: pid ? "starting" : "error",
    error: pid ? null : "Failed to spawn engine process",
  }
  writeState(next)

  child.on("exit", () => {
    const cur = readState()
    if (cur.pid === pid) {
      writeState({
        pid: null,
        startedAt: null,
        status: "stopped",
        error: null,
      })
    }
    child = null
  })

  setTimeout(() => {
    const cur = readState()
    if (cur.pid === pid && pid && isPidAlive(pid)) {
      writeState({ ...cur, status: "running" })
    }
  }, 2000)

  return next
}

export function restartEngineProcess(): SupervisorState {
  // Clear hold first so studio's loop may respawn after the kill.
  setEngineHold(false)
  if (child && !child.killed) {
    try {
      child.kill("SIGTERM")
    } catch {
      // ignore
    }
    child = null
  }
  const state = readState()
  if (state.pid && isPidAlive(state.pid)) {
    try {
      process.kill(state.pid, "SIGTERM")
    } catch {
      try {
        process.kill(state.pid, "SIGKILL")
      } catch {
        // ignore
      }
    }
  }
  try {
    const script = path.join(projectRoot(), "scripts", "kill-engine.sh")
    execSync(`bash "${script}"`, {
      stdio: "ignore",
      timeout: 15_000,
    })
  } catch {
    try {
      execSync("pkill -f '[e]ngine/worker.py' || true", {
        stdio: "ignore",
        timeout: 5000,
      })
    } catch {
      // ignore
    }
  }

  writeState({
    pid: null,
    startedAt: null,
    status: "stopped",
    error: null,
  })

  if (isStudioManagedProcess()) {
    const next: SupervisorState = {
      pid: null,
      startedAt: new Date().toISOString(),
      status: "starting",
      error: null,
    }
    writeState(next)
    return next
  }

  try {
    execSync("sleep 1.5")
  } catch {
    // ignore
  }
  return startEngineProcess()
}
