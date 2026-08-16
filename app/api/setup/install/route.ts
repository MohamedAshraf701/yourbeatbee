import { isDitModel, isEngineFamily, isLmModel } from "@/lib/models"
import { saveSettings } from "@/lib/settings"
import { startInstallPipeline, readSetupStatus } from "@/lib/setup-install"
import { recommendModels } from "@/lib/models"
import { probeSystem } from "@/lib/system-info"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const input = (body || {}) as Record<string, unknown>
  const system = probeSystem()
  const recommendation = recommendModels(system)

  const engineFamily =
    typeof input.engineFamily === "string" && isEngineFamily(input.engineFamily)
      ? input.engineFamily
      : recommendation.engineFamily
  const ditModel =
    typeof input.ditModel === "string" && isDitModel(input.ditModel)
      ? input.ditModel
      : recommendation.ditModel
  const lmModel =
    typeof input.lmModel === "string" && isLmModel(input.lmModel)
      ? input.lmModel
      : recommendation.lmModel

  saveSettings(
    {
      engineFamily,
      ditModel,
      lmModel,
      backend: recommendation.backend,
      device: recommendation.device,
      saveMemory: recommendation.saveMemory,
      heartmulaLazyLoad: recommendation.heartmulaLazyLoad,
      setupComplete: false,
    },
    recommendation
  )

  const mode =
    input.mode === "models" || input.mode === "full" ? input.mode : "full"
  const status = startInstallPipeline({
    engineFamily,
    ditModel,
    lmModel,
    mode,
  })
  return Response.json(status)
}

export async function GET() {
  return Response.json(readSetupStatus())
}
