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
  referenceAudio: string | null
}

export type Job = GenerateInput & {
  id: string
  status: JobStatus
  error?: string
  songId?: string
  createdAt: string
  updatedAt: string
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
}

export type VoiceProfileInfo = {
  ready: boolean
  filename: string | null
  originalName: string | null
  sizeBytes: number | null
  uploadedAt: string | null
}
