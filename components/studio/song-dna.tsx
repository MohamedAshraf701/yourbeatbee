"use client"

import { sliderValue } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

function DnaRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr_3rem] items-center gap-4 sm:grid-cols-[9rem_1fr_3.5rem]">
      <label htmlFor={id} className="meta-caps text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(sliderValue(Number(e.target.value)))}
        className={cn(
          "h-[2px] w-full cursor-pointer appearance-none",
          "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bee",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-bee"
        )}
        style={{
          background: `linear-gradient(to right, var(--bee) ${value}%, color-mix(in srgb, var(--foreground) 12%, transparent) ${value}%)`,
        }}
      />
      <span className="text-right text-xs tabular-nums text-text-muted">
        {value}
      </span>
    </div>
  )
}

export function SongDNA({
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
}: {
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
}) {
  const tempoValue =
    bpm === ""
      ? 50
      : Math.min(100, Math.max(0, ((Number(bpm) || 120) - 60) / 1.8))

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="meta-caps text-bee">04 — Song DNA</p>
        <h2 className="display-section mt-2">Shape the sound</h2>
        <p className="mt-2 max-w-md text-sm text-text-muted">
          These controls go to the model: style adherence, creativity, and tempo.
        </p>
      </div>

      <div
        className="relative overflow-hidden py-8"
        style={
          {
            "--influence": influence / 100,
            "--weirdness": weirdness / 100,
          } as CSSProperties
        }
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center gap-px opacity-25"
        >
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={i}
              className="w-px flex-1 bg-bee origin-center"
              style={{
                height: `${15 + Math.abs(Math.sin(i * 0.3 + influence * 0.02 + weirdness * 0.015)) * (35 + tempoValue * 0.4)}%`,
                animation: `soft-pulse ${0.8 + (i % 5) * 0.1}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative flex flex-col gap-7">
          <DnaRow
            id="influence"
            label="Style lock"
            value={influence}
            onChange={onInfluenceChange}
          />
          <DnaRow
            id="weirdness"
            label="Weirdness"
            value={weirdness}
            onChange={onWeirdnessChange}
          />
          <div className="grid grid-cols-[7rem_1fr_3rem] items-center gap-4 sm:grid-cols-[9rem_1fr_3.5rem]">
            <label htmlFor="tempo" className="meta-caps text-foreground">
              Tempo
            </label>
            <input
              id="tempo"
              type="range"
              min={0}
              max={100}
              step={1}
              value={tempoValue}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v <= 2) {
                  onBpmChange("")
                  return
                }
                onBpmChange(String(Math.round(60 + v * 1.8)))
              }}
              className={cn(
                "h-[2px] w-full cursor-pointer appearance-none",
                "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bee",
                "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-bee"
              )}
              style={{
                background: `linear-gradient(to right, var(--bee) ${tempoValue}%, color-mix(in srgb, var(--foreground) 12%, transparent) ${tempoValue}%)`,
              }}
            />
            <span className="text-right text-xs tabular-nums text-text-muted">
              {bpm === "" ? "Auto" : bpm}
            </span>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="meta-caps text-text-muted hover:text-foreground"
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
        {showAdvanced ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="meta-caps">Seed</span>
              <input
                inputMode="numeric"
                value={seed}
                onChange={(e) => onSeedChange(e.target.value)}
                placeholder="Random"
                className="h-11 border border-border bg-transparent px-3 text-sm outline-none focus:border-bee/40"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="meta-caps">Quality</span>
              <div className="flex h-11 gap-4 border-b border-border">
                <button
                  type="button"
                  onClick={() => onFastChange(false)}
                  className={cn(
                    "meta-caps",
                    !fast ? "text-foreground" : "text-text-muted"
                  )}
                >
                  Quality
                </button>
                <button
                  type="button"
                  onClick={() => onFastChange(true)}
                  className={cn(
                    "meta-caps",
                    fast ? "text-foreground" : "text-text-muted"
                  )}
                >
                  Fast
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
