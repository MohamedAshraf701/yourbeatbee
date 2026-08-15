import { listSongs } from "@/lib/songs"

export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ songs: listSongs() })
}
