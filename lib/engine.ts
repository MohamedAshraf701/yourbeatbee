import { readFileSync } from "node:fs"

import { dataPaths } from "@/lib/paths"
import { getEngineSupervisorStatus } from "@/lib/engine-supervisor"
import type { EngineHealth } from "@/lib/types"

const STALE_MS = 20_000

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readEngineHealth(): EngineHealth {
  const supervisor = getEngineSupervisorStatus()
  try {
    const health = JSON.parse(
      readFileSync(dataPaths().engine, "utf8")
    ) as EngineHealth
    if (!health.updatedAt) {
      return {
        ready: false,
        alive: supervisor.alive,
        error: "Engine heartbeat is missing a timestamp.",
      }
    }
    const age = Date.now() - Date.parse(health.updatedAt)
    const pidAlive = Boolean(health.pid && isPidAlive(health.pid))
    const alive = pidAlive || supervisor.alive
    const stale = Number.isNaN(age) || age > STALE_MS

    // While generating / loading, treat process as alive even if a write lagged.
    if (stale && !alive) {
      return {
        ...health,
        ready: false,
        alive: false,
        error:
          "Engine is not running. Open Setup / Models, or run npm run studio.",
      }
    }

    if (stale && alive) {
      // Heartbeat file lagged but process still up (e.g. heavy generation).
      return {
        ...health,
        ready: Boolean(health.ready),
        alive: true,
        busy: true,
        phase: health.phase || "busy",
        message:
          health.message ||
          "Engine is busy (heartbeat delayed). Generation may still be running.",
        error: undefined,
      }
    }

    return {
      ...health,
      alive: true,
      busy: Boolean(health.busy),
      phase: health.phase,
      progress:
        typeof health.progress === "number" ? health.progress : undefined,
    }
  } catch {
    return {
      ready: false,
      alive: supervisor.alive,
      phase: supervisor.alive ? "starting" : "stopped",
      error: supervisor.alive
        ? "Engine starting — waiting for heartbeat…"
        : "Engine is not running. Open Setup / Models, or run npm run studio.",
    }
  }
}
