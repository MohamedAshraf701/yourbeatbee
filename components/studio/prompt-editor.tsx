"use client"

import * as React from "react"

import { STYLE_CHIPS, applyChip } from "@/lib/chips"
import { cn } from "@/lib/utils"

export function PromptEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [focused, setFocused] = React.useState(false)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="meta-caps text-bee">01 — Idea</p>
        <h2 className="display-section">What&apos;s the song?</h2>
        <p className="max-w-md text-sm text-text-secondary">
          Tell us what you&apos;re hearing.
        </p>
      </div>

      <div
        className={cn(
          "relative transition-[filter] duration-300",
          focused && "field-active"
        )}
      >
        {/* Perimeter frequency frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px overflow-hidden opacity-60"
        >
          <div className="absolute inset-x-0 top-0 flex h-3 items-end gap-px px-1">
            {Array.from({ length: 64 }).map((_, i) => (
              <span
                key={`t-${i}`}
                className="flex-1 bg-bee/70 origin-bottom"
                style={{
                  height: `${20 + Math.abs(Math.sin(i * 0.4)) * 80}%`,
                  animation: focused
                    ? `soft-pulse ${0.6 + (i % 5) * 0.08}s ease-in-out infinite`
                    : undefined,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-3 items-start gap-px px-1">
            {Array.from({ length: 64 }).map((_, i) => (
              <span
                key={`b-${i}`}
                className="flex-1 bg-foreground/25 origin-top"
                style={{
                  height: `${15 + Math.abs(Math.cos(i * 0.35)) * 85}%`,
                  animation: focused
                    ? `soft-pulse ${0.7 + (i % 4) * 0.1}s ease-in-out infinite`
                    : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <textarea
          id="song-idea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={6}
          placeholder="An intimate Bollywood ballad about two people meeting again after years — cinematic strings, soft tabla, male vocals…"
          className={cn(
            "min-h-[180px] w-full resize-y border border-border bg-transparent px-6 py-7 text-lg leading-relaxed text-foreground placeholder:text-text-muted/70",
            "rounded-xl transition-[border-color,background-color] duration-200",
            "focus:border-bee/40 focus:bg-foreground/[0.02] focus:outline-none"
          )}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="meta-caps">✦ Enhance</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {STYLE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange(applyChip(value, chip.value))}
              className="meta-caps text-text-muted transition-all duration-200 hover:scale-[1.06] hover:text-foreground"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
