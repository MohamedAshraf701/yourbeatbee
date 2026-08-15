import { createJob, validateGenerateInput } from "@/lib/jobs"
import { readEngineHealth } from "@/lib/engine"
import { getVoiceProfile } from "@/lib/voices"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const health = readEngineHealth()
  if (!health.ready) {
    return Response.json(
      { error: health.error || "Engine is not ready." },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = validateGenerateInput(body)
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 })
  }

  if (parsed.voice === "custom") {
    const profile = getVoiceProfile()
    if (!profile.ready || !profile.absolutePath) {
      return Response.json(
        { error: "Upload your voice sample first (about 2–3 minutes)." },
        { status: 400 }
      )
    }
    parsed.referenceAudio = profile.absolutePath
  } else {
    parsed.referenceAudio = null
  }

  const job = createJob(parsed)
  return Response.json({ jobId: job.id, job })
}
