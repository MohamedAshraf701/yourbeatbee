import { getVoiceProfile } from "@/lib/voices"

export const dynamic = "force-dynamic"

/** Legacy mic preview endpoint — RVC models are not playable audio. */
export async function GET() {
  const profile = getVoiceProfile()
  if (!profile.ready) {
    return Response.json({ error: "No RVC voice model imported." }, { status: 404 })
  }
  return Response.json(
    {
      error:
        "My Voice is an RVC model file, not a recording. There is nothing to play here.",
      ready: true,
      originalName: profile.originalName,
      format: profile.format,
    },
    { status: 400 }
  )
}
