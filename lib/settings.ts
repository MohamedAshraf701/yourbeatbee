import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"

import {
  type BackendId,
  type DeviceId,
  type DitModelId,
  type EngineFamilyId,
  type HeartmulaVersionId,
  type LmModelId,
  type ModelRecommendation,
  isDitModel,
  isEngineFamily,
  isLmModel,
} from "@/lib/models"
import { dataPaths, ensureDataDirs } from "@/lib/paths"

export type StudioSettings = {
  setupComplete: boolean
  engineFamily: EngineFamilyId
  ditModel: DitModelId
  lmModel: LmModelId
  backend: BackendId
  device: DeviceId
  saveMemory: boolean
  heartmulaVersion: HeartmulaVersionId
  heartmulaLazyLoad: boolean
  recommended: {
    engineFamily: EngineFamilyId
    ditModel: DitModelId
    lmModel: LmModelId
    reason: string
  } | null
  updatedAt: string
}

const DEFAULTS: Omit<StudioSettings, "updatedAt"> = {
  setupComplete: false,
  engineFamily: "ace",
  ditModel: "acestep-v15-turbo",
  lmModel: "acestep-5Hz-lm-0.6B",
  backend: "auto",
  device: "auto",
  saveMemory: true,
  heartmulaVersion: "3B",
  heartmulaLazyLoad: true,
  recommended: null,
}

function settingsPath() {
  return dataPaths().settings
}

function writeAtomic(file: string, payload: unknown) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  renameSync(tmp, file)
}

function normalize(raw: Partial<StudioSettings> | null): StudioSettings {
  const engineFamily =
    raw?.engineFamily && isEngineFamily(raw.engineFamily)
      ? raw.engineFamily
      : DEFAULTS.engineFamily
  const ditModel =
    raw?.ditModel && isDitModel(raw.ditModel)
      ? raw.ditModel
      : DEFAULTS.ditModel
  const lmModel =
    raw?.lmModel && isLmModel(raw.lmModel) ? raw.lmModel : DEFAULTS.lmModel
  const backend =
    raw?.backend === "mlx" || raw?.backend === "pt" || raw?.backend === "auto"
      ? raw.backend
      : DEFAULTS.backend
  const device =
    raw?.device === "mps" ||
    raw?.device === "cuda" ||
    raw?.device === "cpu" ||
    raw?.device === "auto"
      ? raw.device
      : DEFAULTS.device
  const heartmulaVersion =
    raw?.heartmulaVersion === "3B" ? "3B" : DEFAULTS.heartmulaVersion

  return {
    setupComplete: Boolean(raw?.setupComplete),
    engineFamily,
    ditModel,
    lmModel,
    backend,
    device,
    saveMemory: raw?.saveMemory !== false,
    heartmulaVersion,
    heartmulaLazyLoad: raw?.heartmulaLazyLoad !== false,
    recommended: raw?.recommended
      ? {
          engineFamily: isEngineFamily(raw.recommended.engineFamily)
            ? raw.recommended.engineFamily
            : engineFamily,
          ditModel: isDitModel(raw.recommended.ditModel)
            ? raw.recommended.ditModel
            : ditModel,
          lmModel: isLmModel(raw.recommended.lmModel)
            ? raw.recommended.lmModel
            : lmModel,
          reason: String(raw.recommended.reason || ""),
        }
      : null,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  }
}

export function getSettings(): StudioSettings {
  ensureDataDirs()
  mkdirSync(dataPaths().data, { recursive: true })
  if (!existsSync(settingsPath())) {
    return { ...DEFAULTS, updatedAt: new Date().toISOString() }
  }
  try {
    const raw = JSON.parse(
      readFileSync(settingsPath(), "utf8")
    ) as Partial<StudioSettings>
    return normalize(raw)
  } catch {
    return { ...DEFAULTS, updatedAt: new Date().toISOString() }
  }
}

export function saveSettings(
  patch: Partial<StudioSettings>,
  recommendation?: ModelRecommendation | null
): StudioSettings {
  ensureDataDirs()
  const current = getSettings()
  const next = normalize({
    ...current,
    ...patch,
    recommended:
      recommendation != null
        ? {
            engineFamily: recommendation.engineFamily,
            ditModel: recommendation.ditModel,
            lmModel: recommendation.lmModel,
            reason: recommendation.reason,
          }
        : patch.recommended !== undefined
          ? patch.recommended
          : current.recommended,
    updatedAt: new Date().toISOString(),
  })
  writeAtomic(settingsPath(), next)
  return next
}

export function settingsExist(): boolean {
  return existsSync(settingsPath())
}
