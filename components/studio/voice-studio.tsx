"use client"

import { formatBytes } from "@/lib/format"
import type { VoiceProfileInfo } from "@/lib/types"
import { VoiceStrengthSlider } from "@/components/studio/voice-strength"

export function VoiceStudio({
  profile,
  voiceStrength,
  onVoiceStrengthChange,
  onImport,
  onClear,
}: {
  profile: VoiceProfileInfo | null
  voiceStrength: number
  onVoiceStrengthChange: (v: number) => void
  onImport: () => void
  onClear: () => void
}) {
  const ready = Boolean(profile?.ready)

  return (
    <div className="flex flex-col gap-16 pb-16 pt-4">
      <header className="max-w-3xl">
        <p className="meta-caps text-bee">Voice Studio</p>
        <h1 className="display-hero mt-4 text-[clamp(2.75rem,7vw,5.5rem)]">
          Your voice.
          <br />
          Your sound.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-text-secondary">
          Create music with a voice that feels like you.
        </p>
      </header>

      <section className="relative overflow-hidden border-y border-border py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 items-center gap-px opacity-40 md:flex"
        >
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={i}
              className="w-px flex-1 bg-bee origin-center"
              style={{
                height: `${18 + Math.abs(Math.sin(i * 0.38)) * 55}%`,
                animation: ready
                  ? `soft-pulse ${0.55 + (i % 5) * 0.08}s ease-in-out infinite`
                  : undefined,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-xl">
          <div className="flex items-center gap-3">
            <span
              className={
                ready
                  ? "size-2 rounded-full bg-bee"
                  : "size-2 rounded-full bg-text-muted"
              }
            />
            <p className="meta-caps">{ready ? "Ready" : "Empty"}</p>
          </div>

          {ready ? (
            <div className="mt-10 flex flex-col gap-10">
              <div>
                <h2 className="text-3xl font-medium tracking-tight">
                  {profile?.originalName || "Your Voice"}
                </h2>
                <p className="meta-caps mt-2">
                  Local
                  {formatBytes(profile?.sizeBytes)
                    ? ` · ${formatBytes(profile?.sizeBytes)}`
                    : ""}
                </p>
              </div>

              <VoiceStrengthSlider
                value={voiceStrength}
                onChange={onVoiceStrengthChange}
                id="studio-voice-identity"
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
                  className="meta-caps text-text-secondary hover:text-foreground"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="meta-caps text-text-secondary hover:text-foreground"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={onImport}
                  className="meta-caps text-bee hover:underline"
                >
                  Import another
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-10 flex flex-col gap-6">
              <p className="text-sm text-text-secondary">
                Import a singing voice model. It never leaves this device.
              </p>
              <button
                type="button"
                onClick={onImport}
                className="inline-flex w-fit border border-bee/40 bg-bee/10 px-6 py-3 meta-caps text-bee"
              >
                + Import Voice
              </button>
              <details className="text-xs text-text-muted">
                <summary className="cursor-pointer meta-caps hover:text-text-secondary">
                  Advanced details
                </summary>
                <p className="mt-3 leading-relaxed">
                  Voice conversion runs locally after generation. Supported: ZIP
                  / .pth exports.
                </p>
              </details>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
