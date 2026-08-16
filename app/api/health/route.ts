import { readEngineHealth } from "@/lib/engine"
import { getSettings } from "@/lib/settings"
import { getEngineSupervisorStatus } from "@/lib/engine-supervisor"
import { probeSystemWithRecommendation } from "@/lib/system-info"
import { readSetupStatus } from "@/lib/setup-install"
import { maybeAutoStopEngine } from "@/lib/presence"

export const dynamic = "force-dynamic"

export async function GET() {
  const autoStop = maybeAutoStopEngine()
  const health = readEngineHealth()
  const settings = getSettings()
  const supervisor = getEngineSupervisorStatus()
  const { system, recommendation } = probeSystemWithRecommendation()
  const setup = readSetupStatus()
  const familyReady =
    settings.engineFamily === "heartmula"
      ? system.heartmulaReady
      : system.vendorReady
  return Response.json({
    ...health,
    engineFamily: settings.engineFamily,
    settings,
    supervisor,
    system,
    recommendation,
    setup,
    autoStop,
    needsSetup: !settings.setupComplete || !familyReady,
  })
}
