/** Canonical model IDs and hardware → recommendation rules (shared by UI + APIs). */

export const ENGINE_FAMILIES = [
  {
    id: "ace",
    label: "ACE-Step 1.5",
    blurb: "DiT + LM. Best on Apple Silicon (MLX / MPS).",
    hint: "Recommended default on Mac. Lower VRAM than HeartMuLa.",
  },
  {
    id: "heartmula",
    label: "HeartMuLa",
    blurb: "Lyrics + tags music LM (3B). Strong lyric control.",
    hint: "Best on CUDA GPU. Prefer lazy-load on a single card.",
  },
] as const

export const DIT_MODELS = [
  {
    id: "acestep-v15-turbo",
    label: "Turbo DiT",
    blurb: "Faster, lower memory. Best default on Mac.",
  },
  {
    id: "acestep-v15-sft",
    label: "SFT DiT",
    blurb: "Stronger style following; needs more RAM (≥20GB recommended).",
  },
] as const

export const LM_MODELS = [
  {
    id: "acestep-5Hz-lm-0.6B",
    label: "0.6B LM",
    blurb: "Fits 16–24GB unified memory. Safer on Apple Silicon.",
  },
  {
    id: "acestep-5Hz-lm-1.7B",
    label: "1.7B LM",
    blurb: "Higher quality. Prefer ≥32GB unified memory (or strong CUDA).",
  },
  {
    id: "acestep-5Hz-lm-4B",
    label: "4B LM",
    blurb: "Largest LM. Only for high-VRAM GPUs; often OOMs on Mac.",
  },
] as const

export type EngineFamilyId = (typeof ENGINE_FAMILIES)[number]["id"]
export type DitModelId = (typeof DIT_MODELS)[number]["id"]
export type LmModelId = (typeof LM_MODELS)[number]["id"]
export type BackendId = "mlx" | "pt" | "auto"
export type DeviceId = "mps" | "cuda" | "cpu" | "auto"
export type HeartmulaVersionId = "3B"

export type SystemSnapshot = {
  os: string
  arch: string
  ramGb: number
  device: "mps" | "cuda" | "cpu"
  backend: "mlx" | "pt"
  cudaVramGb: number | null
  vendorReady: boolean
  heartmulaReady: boolean
  rvcReady: boolean
}

export type ModelRecommendation = {
  engineFamily: EngineFamilyId
  ditModel: DitModelId
  lmModel: LmModelId
  backend: "mlx" | "pt"
  device: "mps" | "cuda" | "cpu"
  saveMemory: boolean
  heartmulaLazyLoad: boolean
  reason: string
  warnings: string[]
  /** Alternate LM users may try (with higher OOM risk). */
  advancedLm: LmModelId | null
}

export function isEngineFamily(id: string): id is EngineFamilyId {
  return ENGINE_FAMILIES.some((m) => m.id === id)
}

export function isDitModel(id: string): id is DitModelId {
  return DIT_MODELS.some((m) => m.id === id)
}

export function isLmModel(id: string): id is LmModelId {
  return LM_MODELS.some((m) => m.id === id)
}

export function engineFamilyLabel(id: string | null | undefined): string {
  const found = ENGINE_FAMILIES.find((f) => f.id === id)
  return found?.label || "ACE-Step 1.5"
}

/** Single source of truth for setup + worker defaults. */
export function recommendModels(system: SystemSnapshot): ModelRecommendation {
  const warnings: string[] = []
  const { device, ramGb, cudaVramGb, backend } = system

  if (device === "mps") {
    warnings.push(
      "HeartMuLa is CUDA-oriented; ACE-Step remains the Mac-safe default."
    )
    if (ramGb < 24) {
      return {
        engineFamily: "ace",
        ditModel: "acestep-v15-turbo",
        lmModel: "acestep-5Hz-lm-0.6B",
        backend: "mlx",
        device: "mps",
        saveMemory: true,
        heartmulaLazyLoad: true,
        reason: `Apple Silicon with ~${ramGb.toFixed(0)}GB RAM — ACE-Step Turbo + 0.6B LM.`,
        warnings: [
          ...warnings,
          "Keep songs shorter if you hit memory errors.",
        ],
        advancedLm: null,
      }
    }
    if (ramGb < 32) {
      warnings.push(
        "1.7B LM may OOM on long lyrics at this RAM size. Prefer 0.6B unless you need quality."
      )
      return {
        engineFamily: "ace",
        ditModel: "acestep-v15-turbo",
        lmModel: "acestep-5Hz-lm-0.6B",
        backend: "mlx",
        device: "mps",
        saveMemory: true,
        heartmulaLazyLoad: true,
        reason: `Apple Silicon with ~${ramGb.toFixed(0)}GB RAM — ACE-Step Turbo + 0.6B (safe default).`,
        warnings,
        advancedLm: "acestep-5Hz-lm-1.7B",
      }
    }
    return {
      engineFamily: "ace",
      ditModel: "acestep-v15-turbo",
      lmModel: "acestep-5Hz-lm-1.7B",
      backend: "mlx",
      device: "mps",
      saveMemory: true,
      heartmulaLazyLoad: true,
      reason: `Apple Silicon with ~${ramGb.toFixed(0)}GB RAM — ACE-Step Turbo + 1.7B LM recommended.`,
      warnings: [
        ...warnings,
        "SFT DiT is optional if you want stronger style control.",
      ],
      advancedLm: "acestep-5Hz-lm-4B",
    }
  }

  if (device === "cuda") {
    const vram = cudaVramGb ?? 0
    const lazy = vram < 16
    if (vram < 12) {
      warnings.push("Enable lazy-load for HeartMuLa on GPUs under ~12GB VRAM.")
    }
    if (vram >= 16) {
      return {
        engineFamily: "heartmula",
        ditModel: "acestep-v15-turbo",
        lmModel: "acestep-5Hz-lm-1.7B",
        backend: "pt",
        device: "cuda",
        saveMemory: false,
        heartmulaLazyLoad: lazy,
        reason: `CUDA with ~${vram.toFixed(0)}GB VRAM — HeartMuLa 3B recommended (ACE-Step also available).`,
        warnings,
        advancedLm: "acestep-5Hz-lm-4B",
      }
    }
    return {
      engineFamily: "heartmula",
      ditModel: "acestep-v15-turbo",
      lmModel: "acestep-5Hz-lm-0.6B",
      backend: "pt",
      device: "cuda",
      saveMemory: true,
      heartmulaLazyLoad: true,
      reason: `CUDA with limited VRAM (~${vram.toFixed(0)}GB) — HeartMuLa 3B with lazy-load (or ACE-Step 0.6B).`,
      warnings: [
        ...warnings,
        "Upgrade GPU VRAM before trying larger ACE LMs.",
      ],
      advancedLm: vram >= 10 ? "acestep-5Hz-lm-1.7B" : null,
    }
  }

  return {
    engineFamily: "ace",
    ditModel: "acestep-v15-turbo",
    lmModel: "acestep-5Hz-lm-0.6B",
    backend: backend === "mlx" ? "mlx" : "pt",
    device: "cpu",
    saveMemory: true,
    heartmulaLazyLoad: true,
    reason: `CPU-only (~${ramGb.toFixed(0)}GB RAM) — ACE-Step Turbo + 0.6B (slow).`,
    warnings: [
      "Generation will be very slow without MPS or CUDA.",
      "HeartMuLa is not practical on CPU.",
    ],
    advancedLm: null,
  }
}
