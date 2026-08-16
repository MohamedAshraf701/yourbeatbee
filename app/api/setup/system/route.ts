import { probeSystemWithRecommendation } from "@/lib/system-info"
import { DIT_MODELS, ENGINE_FAMILIES, LM_MODELS } from "@/lib/models"

export const dynamic = "force-dynamic"

export async function GET() {
  const { system, recommendation } = probeSystemWithRecommendation()
  return Response.json({
    system,
    recommendation,
    engineFamilies: ENGINE_FAMILIES,
    ditModels: DIT_MODELS,
    lmModels: LM_MODELS,
  })
}
