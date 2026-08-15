import {
  clearVoiceProfile,
  getVoiceProfile,
  saveRvcUpload,
} from "@/lib/voices"

export const dynamic = "force-dynamic"

export async function GET() {
  const profile = getVoiceProfile()
  return Response.json({
    ready: profile.ready,
    kind: profile.kind,
    filename: profile.filename,
    originalName: profile.originalName,
    sizeBytes: profile.sizeBytes,
    uploadedAt: profile.uploadedAt,
    format: profile.format,
    hasIndex: Boolean(profile.indexPath),
  })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Choose an RVC model zip or .pth file." },
      { status: 400 }
    )
  }

  const indexFile = form.get("index")
  const indexBuffer =
    indexFile instanceof File
      ? Buffer.from(await indexFile.arrayBuffer())
      : null

  const buffer = Buffer.from(await file.arrayBuffer())
  const saved = saveRvcUpload({
    originalName: file.name || "model.zip",
    buffer,
    indexBuffer,
    indexName: indexFile instanceof File ? indexFile.name : null,
  })
  if (typeof saved === "string") {
    return Response.json({ error: saved }, { status: 400 })
  }

  return Response.json({
    ready: saved.ready,
    kind: saved.kind,
    filename: saved.filename,
    originalName: saved.originalName,
    sizeBytes: saved.sizeBytes,
    uploadedAt: saved.uploadedAt,
    format: saved.format,
    hasIndex: Boolean(saved.indexPath),
  })
}

export async function DELETE() {
  clearVoiceProfile()
  return Response.json({ ready: false, kind: null })
}
