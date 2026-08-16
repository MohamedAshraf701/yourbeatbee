import { getSettings, saveSettings } from "@/lib/settings"
import {
  isDitModel,
  isEngineFamily,
  isLmModel,
  recommendModels,
} from "@/lib/models"
import { probeSystem } from "@/lib/system-info"
import type { BackendId, DeviceId } from "@/lib/models"

export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(getSettings())
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }
  const input = body as Record<string, unknown>
  const patch: Parameters<typeof saveSettings>[0] = {}

  if (typeof input.engineFamily === "string") {
    if (!isEngineFamily(input.engineFamily)) {
      return Response.json({ error: "Unknown engine family" }, { status: 400 })
    }
    patch.engineFamily = input.engineFamily
  }
  if (typeof input.ditModel === "string") {
    if (!isDitModel(input.ditModel)) {
      return Response.json({ error: "Unknown DiT model" }, { status: 400 })
    }
    patch.ditModel = input.ditModel
  }
  if (typeof input.lmModel === "string") {
    if (!isLmModel(input.lmModel)) {
      return Response.json({ error: "Unknown LM model" }, { status: 400 })
    }
    patch.lmModel = input.lmModel
  }
  if (
    input.backend === "mlx" ||
    input.backend === "pt" ||
    input.backend === "auto"
  ) {
    patch.backend = input.backend as BackendId
  }
  if (
    input.device === "mps" ||
    input.device === "cuda" ||
    input.device === "cpu" ||
    input.device === "auto"
  ) {
    patch.device = input.device as DeviceId
  }
  if (typeof input.saveMemory === "boolean") {
    patch.saveMemory = input.saveMemory
  }
  if (input.heartmulaVersion === "3B") {
    patch.heartmulaVersion = "3B"
  }
  if (typeof input.heartmulaLazyLoad === "boolean") {
    patch.heartmulaLazyLoad = input.heartmulaLazyLoad
  }
  if (typeof input.setupComplete === "boolean") {
    patch.setupComplete = input.setupComplete
  }

  const system = probeSystem()
  const recommendation = recommendModels(system)
  const saved = saveSettings(patch, recommendation)
  return Response.json(saved)
}
