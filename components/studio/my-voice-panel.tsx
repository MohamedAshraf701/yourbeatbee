"use client"

import { formatBytes } from "@/lib/format"
import type { VoiceProfileInfo } from "@/lib/types"
import { VoiceStrengthSlider } from "@/components/studio/voice-strength"

export function MyVoicePanel({
  profile,
  voiceStrength,
  onVoiceStrengthChange,
  onImport,
  onClear,
}: {
  profile: VoiceProfileInfo | null
  voiceStrength: number
  onVoiceStrengthChange: (value: number) => void
  onImport: () => void
  onClear: () => void
}) {
  const ready = Boolean(profile?.ready)

  return (
    <section className="relative overflow-hidden border-y border-border py-10">
      <div className="absolute inset-y-0 right-0 w-1/2 opacity-30">
        <div className="flex h-full items-center gap-px px-4">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="w-px flex-1 bg-bee origin-center"
              style={{
                height: `${20 + Math.abs(Math.sin(i * 0.4)) * 60}%`,
                animation: ready
                  ? `soft-pulse ${0.6 + (i % 4) * 0.1}s ease-in-out infinite`
                  : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative max-w-xl">
        <p className="meta-caps text-bee">My Voice</p>
        <h3 className="mt-3 text-2xl font-medium tracking-tight">
          {ready ? "Your voice is ready" : "Bring your voice into your music"}
        </h3>

        {ready ? (
          <div className="mt-8 flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <span className="size-2 rounded-full bg-bee" />
              <div>
                <p className="text-sm font-medium">
                  {profile?.originalName || "Your Voice"}
                </p>
                <p className="meta-caps mt-1">
                  Ready · Local
                  {formatBytes(profile?.sizeBytes)
                    ? ` · ${formatBytes(profile?.sizeBytes)}`
                    : ""}
                </p>
              </div>
            </div>

            <VoiceStrengthSlider
              value={voiceStrength}
              onChange={onVoiceStrengthChange}
            />

            <div className="flex flex-wrap gap-6">
              <button
                type="button"
                disabled
                title="Unavailable"
                className="meta-caps text-text-muted opacity-40"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={onImport}
                className="meta-caps text-text-secondary transition-colors hover:text-foreground"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={onClear}
                className="meta-caps text-text-secondary transition-colors hover:text-foreground"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <p className="text-sm text-text-secondary">
              No voice model yet. Import stays on this device.
            </p>
            <button
              type="button"
              onClick={onImport}
              className="inline-flex w-fit items-center gap-3 border border-bee/40 bg-bee/10 px-6 py-3 meta-caps text-bee transition-colors hover:bg-bee/15"
            >
              + Import Voice
            </button>
            <details className="text-xs text-text-muted">
              <summary className="cursor-pointer meta-caps hover:text-text-secondary">
                Advanced details
              </summary>
              <p className="mt-3 leading-relaxed">
                Supported: voice model ZIP / .pth. Uses local conversion after
                each song.
              </p>
            </details>
          </div>
        )}
      </div>
    </section>
  )
}
