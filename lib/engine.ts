import { readFileSync } from "node:fs"

import { dataPaths } from "@/lib/paths"
import type { EngineHealth } from "@/lib/types"

const STALE_MS = 15_000

export function readEngineHealth(): EngineHealth {
  try {
    const health = JSON.parse(
      readFileSync(dataPaths().engine, "utf8")
    ) as EngineHealth
    if (!health.updatedAt) {
      return { ready: false, error: "Engine heartbeat is missing a timestamp." }
    }
    const age = Date.now() - Date.parse(health.updatedAt)
    if (Number.isNaN(age) || age > STALE_MS) {
      return {
        ...health,
        ready: false,
        error: "Engine is not running. Start it with npm run engine.",
      }
    }
    return health
  } catch {
    return {
      ready: false,
      error: "Engine is not running. Start it with npm run engine.",
    }
  }
}
