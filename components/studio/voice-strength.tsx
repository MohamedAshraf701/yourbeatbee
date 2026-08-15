"use client"

import { sliderValue } from "@/lib/format"
import { cn } from "@/lib/utils"

export function VoiceStrengthSlider({
  value,
  onChange,
  id = "voice-identity",
}: {
  value: number
  onChange: (value: number) => void
  id?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <label htmlFor={id} className="meta-caps">
          Voice Identity
        </label>
        <span className="text-sm tabular-nums text-foreground">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(sliderValue(Number(e.target.value)))}
        className={cn(
          "h-[2px] w-full cursor-pointer appearance-none rounded-none",
          "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bee",
          "[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-bee"
        )}
        style={{
          background: `linear-gradient(to right, var(--bee) ${value}%, color-mix(in srgb, var(--foreground) 12%, transparent) ${value}%)`,
        }}
      />
      <div className="flex justify-between meta-caps">
        <span>Subtle</span>
        <span>Strong</span>
      </div>
      <div className="flex h-7 items-end gap-px opacity-70">
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className="flex-1 bg-bee origin-bottom"
            style={{
              height: `${18 + Math.abs(Math.sin((i + value) * 0.35)) * 82}%`,
              animation: `soft-pulse ${0.5 + (i % 5) * 0.08}s ease-in-out infinite`,
              animationDelay: `${i * 25}ms`,
            }}
          />
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Higher strength creates a stronger voice identity.
      </p>
    </div>
  )
}
