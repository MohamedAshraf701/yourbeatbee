"use client"

import type * as React from "react"

import type { Job, Language, Song, Voice, VoiceProfileInfo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PromptEditor } from "@/components/studio/prompt-editor"
import { LyricsEditor } from "@/components/studio/lyrics-editor"
import { VoiceSelector } from "@/components/studio/voice-selector"
import { MyVoicePanel } from "@/components/studio/my-voice-panel"
import { SongDNA } from "@/components/studio/song-dna"
import { LanguageSelector } from "@/components/studio/language-selector"
import { DurationSelector } from "@/components/studio/duration-selector"
import { GenerateButton } from "@/components/studio/generate-button"
import { GenerationState } from "@/components/studio/generation-state"
import { NowPlaying } from "@/components/studio/now-playing"

const HERO_LINES = ["Make", "something", "you", "can hear."]

export function CreateWorkspace({
  style,
  onStyleChange,
  lyrics,
  onLyricsChange,
  voice,
  onVoiceChange,
  voiceProfile,
  voiceStrength,
  onVoiceStrengthChange,
  onImportVoice,
  onClearVoice,
  language,
  onLanguageChange,
  duration,
  onDurationChange,
  influence,
  weirdness,
  bpm,
  onInfluenceChange,
  onWeirdnessChange,
  onBpmChange,
  seed,
  fast,
  onSeedChange,
  onFastChange,
  showAdvanced,
  onToggleAdvanced,
  onGenerate,
  busy,
  generateDisabled,
  generating,
  job,
  progress,
  current,
  engineNotice,
  engineLabel,
  onOpenEngine,
}: {
  style: string
  onStyleChange: (v: string) => void
  lyrics: string
  onLyricsChange: (v: string) => void
  voice: Voice
  onVoiceChange: (v: Voice) => void
  voiceProfile: VoiceProfileInfo | null
  voiceStrength: number
  onVoiceStrengthChange: (v: number) => void
  onImportVoice: () => void
  onClearVoice: () => void
  language: Language
  onLanguageChange: (v: Language) => void
  duration: string
  onDurationChange: (v: string) => void
  influence: number
  weirdness: number
  bpm: string
  onInfluenceChange: (v: number) => void
  onWeirdnessChange: (v: number) => void
  onBpmChange: (v: string) => void
  seed: string
  fast: boolean
  onSeedChange: (v: string) => void
  onFastChange: (v: boolean) => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onGenerate: (e: React.FormEvent) => void
  busy: boolean
  generateDisabled: boolean
  generating: boolean
  job: Job | null
  progress: number
  current: Song | null
  engineNotice: React.ReactNode
  engineLabel?: string
  onOpenEngine?: () => void
}) {
  return (
    <div className="flex flex-col gap-0">
      <section className="relative grid gap-10 pb-12 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:items-start lg:gap-12 xl:gap-16">
        <div className="relative flex flex-col gap-8 lg:pt-4">
          <p
            className="meta-caps text-text-muted reveal-up"
            style={{ animationDelay: "40ms" }}
          >
            Local music studio
          </p>

          {engineLabel ? (
            <button
              type="button"
              onClick={onOpenEngine}
              className="meta-caps w-fit text-bee transition-colors hover:underline reveal-up"
              style={{ animationDelay: "80ms" }}
            >
              Engine · {engineLabel}
            </button>
          ) : null}
          <h1 className="display-hero">
            {HERO_LINES.map((line, li) => (
              <span
                key={line}
                className="block reveal-up"
                style={{ animationDelay: `${80 + li * 70}ms` }}
              >
                {line.split("").map((ch, ci) => (
                  <span key={`${li}-${ci}`} className="letter-shift">
                    {ch === " " ? "\u00A0" : ch}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <div className="hairline max-w-xs reveal-up" style={{ animationDelay: "360ms" }} />

          <p
            className="max-w-sm text-sm leading-relaxed text-text-secondary reveal-up"
            style={{ animationDelay: "420ms" }}
          >
            Turn an idea, lyric, or mood into an original song — composed on this
            machine.
          </p>

          <ol
            className="flex flex-wrap gap-x-5 gap-y-2 reveal-up"
            style={{ animationDelay: "480ms" }}
          >
            {["Idea", "Lyrics", "Voice", "DNA", "Create"].map((stage, i) => (
              <li key={stage} className="meta-caps text-text-muted">
                <span className="text-bee">{String(i + 1).padStart(2, "0")}</span>
                {" · "}
                {stage}
              </li>
            ))}
          </ol>
        </div>

        <NowPlaying
          song={current}
          className="reveal-up lg:sticky lg:top-6"
        />
      </section>

      {engineNotice ? (
        <div className="mb-12 border-y border-border py-4">{engineNotice}</div>
      ) : null}

      {generating ? (
        <div className="border-t border-border">
          <GenerationState job={job} progress={progress} />
        </div>
      ) : null}

      <form
        onSubmit={onGenerate}
        className={cn("flex flex-col", generating && "pointer-events-none opacity-40")}
        aria-hidden={generating}
      >
          <div className="border-t border-border py-16">
            <PromptEditor value={style} onChange={onStyleChange} />
          </div>

          <div className="border-t border-border py-16">
            <LyricsEditor value={lyrics} onChange={onLyricsChange} />
          </div>

          <div className="border-t border-border py-16">
            <VoiceSelector value={voice} onChange={onVoiceChange} />
            {voice === "custom" ? (
              <div className="mt-10">
                <MyVoicePanel
                  profile={voiceProfile}
                  voiceStrength={voiceStrength}
                  onVoiceStrengthChange={onVoiceStrengthChange}
                  onImport={onImportVoice}
                  onClear={onClearVoice}
                />
              </div>
            ) : null}
          </div>

          <div className="border-t border-border py-12">
            <div className="grid gap-10 sm:grid-cols-2">
              <LanguageSelector value={language} onChange={onLanguageChange} />
              <DurationSelector value={duration} onChange={onDurationChange} />
            </div>
          </div>

          <div className="border-t border-border py-16">
            <SongDNA
              influence={influence}
              weirdness={weirdness}
              bpm={bpm}
              onInfluenceChange={onInfluenceChange}
              onWeirdnessChange={onWeirdnessChange}
              onBpmChange={onBpmChange}
              seed={seed}
              fast={fast}
              onSeedChange={onSeedChange}
              onFastChange={onFastChange}
              showAdvanced={showAdvanced}
              onToggleAdvanced={onToggleAdvanced}
            />
          </div>

          <div className="border-t border-border py-12">
            <p className="meta-caps text-bee mb-6">05 — Generate</p>
            <GenerateButton busy={busy} disabled={generateDisabled} />
          </div>
      </form>
    </div>
  )
}
