import { clearVoiceProfile, getVoiceProfile, saveVoiceUpload } from "@/lib/voices"

export const dynamic = "force-dynamic"

export async function GET() {
  const profile = getVoiceProfile()
  return Response.json({
    ready: profile.ready,
    filename: profile.filename,
    originalName: profile.originalName,
    sizeBytes: profile.sizeBytes,
    uploadedAt: profile.uploadedAt,
  })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an audio file." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const saved = saveVoiceUpload({
    originalName: file.name || "voice.wav",
    buffer,
  })
  if (typeof saved === "string") {
    return Response.json({ error: saved }, { status: 400 })
  }

  return Response.json({
    ready: saved.ready,
    filename: saved.filename,
    originalName: saved.originalName,
    sizeBytes: saved.sizeBytes,
    uploadedAt: saved.uploadedAt,
  })
}

export async function DELETE() {
  clearVoiceProfile()
  return Response.json({ ready: false })
}
