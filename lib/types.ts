export type Voice = "male" | "female" | "instrumental" | "custom"
export type Language = "auto" | "hi" | "en"
export type JobStatus = "queued" | "running" | "done" | "error"

export type GenerateInput = {
  style: string
  lyrics: string
  voice: Voice
  language: Language
  influence: number
  weirdness: number
  duration: number
  bpm: number | null
  seed: number
  fast: boolean
  voiceStrength: number
  /** @deprecated Mic reference — My Voice now uses imported RVC models. */
  referenceAudio: string | null
  rvcModelPath: string | null
  rvcIndexPath: string | null
}

export type Job = GenerateInput & {
  id: string
  status: JobStatus
  error?: string
  songId?: string
  createdAt: string
  updatedAt: string
  /** 0–100 while queued/running */
  progress?: number
  phase?: string
  message?: string
}

export type Song = {
  id: string
  style: string
  lyrics: string
  voice: Voice
  language: Language
  influence: number
  weirdness: number
  duration: number
  bpm: number | null
  seed: number
  caption: string
  audioFile: string
  voiceStrength?: number
  createdAt: string
}

export type EngineHealth = {
  ready: boolean
  device?: string
  model?: string
  lm?: string
  pid?: number
  error?: string
  message?: string
  updatedAt?: string
  /** Engine process is alive (even if model still loading). */
  alive?: boolean
  busy?: boolean
  phase?: string
  progress?: number
  needsSetup?: boolean
  settings?: {
    setupComplete: boolean
    ditModel: string
    lmModel: string
    backend: string
    device: string
    saveMemory: boolean
  }
  system?: {
    os: string
    arch: string
    ramGb: number
    device: string
    backend: string
    cudaVramGb: number | null
    vendorReady: boolean
    rvcReady: boolean
  }
  recommendation?: {
    ditModel: string
    lmModel: string
    reason: string
    warnings: string[]
    advancedLm: string | null
  }
}

export type VoiceProfileInfo = {
  ready: boolean
  kind?: "rvc" | null
  filename: string | null
  originalName: string | null
  sizeBytes: number | null
  uploadedAt: string | null
  format?: string | null
  hasIndex?: boolean
}
