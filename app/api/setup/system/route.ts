import { probeSystemWithRecommendation } from "@/lib/system-info"
import { DIT_MODELS, LM_MODELS } from "@/lib/models"

export const dynamic = "force-dynamic"

export async function GET() {
  const { system, recommendation } = probeSystemWithRecommendation()
  return Response.json({
    system,
    recommendation,
    ditModels: DIT_MODELS,
    lmModels: LM_MODELS,
  })
}
