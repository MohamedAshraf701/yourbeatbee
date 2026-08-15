export type StudioView = "create" | "library" | "voices" | "engine"

export const STUDIO_NAV: { id: StudioView; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "library", label: "Library" },
  { id: "voices", label: "Voices" },
  { id: "engine", label: "Engine" },
]
