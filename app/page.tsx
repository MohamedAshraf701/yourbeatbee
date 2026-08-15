import { Studio } from "@/components/studio"
import { listSongs } from "@/lib/songs"

export const dynamic = "force-dynamic"

export default function Page() {
  const songs = listSongs()
  return <Studio initialSongs={songs} />
}
