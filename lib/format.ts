import type { Language, Voice } from "@/lib/types"

export function formatBytes(size: number | null | undefined) {
  if (!size) {
    return ""
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00"
  }
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function voiceLabel(voice: Voice) {
  switch (voice) {
    case "custom":
      return "My Voice"
    case "instrumental":
      return "Instrumental"
    case "male":
      return "Male"
    case "female":
      return "Female"
    default:
      return voice
  }
}

export function languageLabel(language: Language) {
  switch (language) {
    case "hi":
      return "Hindi"
    case "en":
      return "English"
    default:
      return "Auto"
  }
}

export function songTitle(style: string | null | undefined) {
  const trimmed = (style || "").trim()
  if (!trimmed) {
    return "Untitled"
  }
  const first = trimmed.split(/[,.]/)[0]?.trim() || trimmed
  if (first.length <= 42) {
    return first.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return first.slice(0, 40).trim() + "…"
}

export function sliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? Number(value[0] ?? 0) : Number(value)
}

export function ditDisplayName(id: string | undefined) {
  if (!id) return "—"
  if (id.includes("turbo")) return "Turbo DiT"
  if (id.includes("sft")) return "SFT DiT"
  return id
}

export function lmDisplayName(id: string | undefined) {
  if (!id) return "—"
  if (id.includes("0.6B")) return "0.6B"
  if (id.includes("1.7B")) return "1.7B"
  if (id.includes("4B")) return "4B"
  return id
}
