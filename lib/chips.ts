export const STYLE_CHIPS = [
  "romantic Bollywood",
  "dance Bollywood",
  "classic 90s Bollywood",
  "cinematic Hollywood",
  "pop Hollywood",
  "trailer Hollywood",
] as const

export function applyChip(style: string, chip: string) {
  const current = style.trim()
  if (!current) {
    return chip
  }
  if (current.toLowerCase().includes(chip.toLowerCase())) {
    return current
  }
  return `${current}, ${chip}`
}
