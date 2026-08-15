import { isDitModel, isLmModel } from "@/lib/models"
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
      ditModel,
      lmModel,
      backend: recommendation.backend,
      device: recommendation.device,
      saveMemory: recommendation.saveMemory,
      setupComplete: false,
    },
    recommendation
  )

  const mode =
    input.mode === "models" || input.mode === "full" ? input.mode : "full"
  const status = startInstallPipeline({ ditModel, lmModel, mode })
  return Response.json(status)
}

export async function GET() {
  return Response.json(readSetupStatus())
}
