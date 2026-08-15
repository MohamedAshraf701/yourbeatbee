import { readFile } from "node:fs/promises"
import path from "node:path"

import { getVoiceProfile } from "@/lib/voices"

export const dynamic = "force-dynamic"

const TYPES: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
}

export async function GET() {
  const profile = getVoiceProfile()
  if (!profile.ready || !profile.absolutePath || !profile.filename) {
    return Response.json({ error: "No voice uploaded." }, { status: 404 })
  }

  const bytes = await readFile(profile.absolutePath)
  const ext = path.extname(profile.filename).toLowerCase()
  return new Response(bytes, {
    headers: {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
