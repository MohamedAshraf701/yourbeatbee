/** Short mood labels shown in UI; values appended to the style prompt. */
export const STYLE_CHIPS = [
  { label: "Romantic", value: "romantic, intimate, emotional" },
  { label: "Cinematic", value: "cinematic, sweeping strings, film score" },
  { label: "Bollywood", value: "Bollywood, bansuri, tabla" },
  { label: "Dreamy", value: "dreamy, atmospheric, soft pads" },
  { label: "Soulful", value: "soulful, rich vocals, warm keys" },
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
