import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { dataPaths, ensureDataDirs, isSafeId } from "@/lib/paths"
import type { Song } from "@/lib/types"

export function getSong(id: string): Song | null {
  if (!isSafeId(id)) {
    return null
  }
  try {
    return JSON.parse(
      readFileSync(path.join(dataPaths().songs, `${id}.json`), "utf8")
    ) as Song
  } catch {
    return null
  }
}

export function songAudioPath(song: Song) {
  return path.join(dataPaths().songs, song.audioFile || `${song.id}.mp3`)
}

export function songAudioExists(song: Song) {
  return existsSync(songAudioPath(song))
}

export function listSongs(): Song[] {
  ensureDataDirs()
  return readdirSync(dataPaths().songs)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(
          readFileSync(path.join(dataPaths().songs, name), "utf8")
        ) as Song
      } catch {
        return null
      }
    })
    .filter((song): song is Song => Boolean(song))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
