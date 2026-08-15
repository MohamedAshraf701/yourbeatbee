/** Deterministic generative artwork — geometry + texture, not blob placeholders. */

export type ArtMood =
  | "romantic"
  | "cinematic"
  | "lofi"
  | "energetic"
  | "bollywood"
  | "default"

export type SongArtSpec = {
  mood: ArtMood
  seed: number
  hues: [number, number, number]
  bands: number[]
  geometry: "bands" | "lattice" | "arcs" | "grain" | "shards"
  titleGlyphs: string[]
}

function hashString(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function detectMood(style: string): ArtMood {
  const s = style.toLowerCase()
  if (/bollywood|hindi|tabla|bansuri|filmi/.test(s)) return "bollywood"
  if (/romantic|intimate|ballad|love|soul/.test(s)) return "romantic"
  if (/cinematic|trailer|film|orchestr|epic|dramatic/.test(s)) return "cinematic"
  if (/lo-?fi|chill|vinyl|ambient|dreamy/.test(s)) return "lofi"
  if (/energetic|dance|upbeat|driving|party/.test(s)) return "energetic"
  return "default"
}

const MOOD: Record<
  ArtMood,
  { hues: [number, number, number]; geometry: SongArtSpec["geometry"] }
> = {
  romantic: { hues: [18, 350, 32], geometry: "arcs" },
  cinematic: { hues: [210, 28, 200], geometry: "bands" },
  lofi: { hues: [40, 25, 55], geometry: "grain" },
  energetic: { hues: [38, 12, 48], geometry: "shards" },
  bollywood: { hues: [28, 8, 42], geometry: "lattice" },
  default: { hues: [42, 30, 200], geometry: "bands" },
}

export function getSongArt(id: string, style = ""): SongArtSpec {
  const seed = hashString(`${id}:${style}`)
  const rand = mulberry32(seed)
  const mood = detectMood(style)
  const base = MOOD[mood]
  const hues: [number, number, number] = [
    base.hues[0] + (rand() - 0.5) * 14,
    base.hues[1] + (rand() - 0.5) * 18,
    base.hues[2] + (rand() - 0.5) * 20,
  ]
  const bands = Array.from({ length: 14 }, () => 0.2 + rand() * 0.8)
  const words = (style || "SONG").toUpperCase().split(/\s+/).filter(Boolean)
  const titleGlyphs = (words[0] || "YBB").slice(0, 4).split("")

  return {
    mood,
    seed,
    hues,
    bands,
    geometry: base.geometry,
    titleGlyphs,
  }
}
