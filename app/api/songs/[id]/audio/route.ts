import { readFile } from "node:fs/promises"

import { getSong, songAudioExists, songAudioPath } from "@/lib/songs"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const song = getSong(id)
  if (!song || !songAudioExists(song)) {
    return Response.json({ error: "Audio not found." }, { status: 404 })
  }

  const download = new URL(request.url).searchParams.get("download")
  const bytes = await readFile(songAudioPath(song))
  const filename = song.audioFile || `${song.id}.mp3`
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."))
  const contentType =
    ext === ".wav"
      ? "audio/wav"
      : ext === ".flac"
        ? "audio/flac"
        : "audio/mpeg"

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": download
        ? `attachment; filename="${filename}"`
        : "inline",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
