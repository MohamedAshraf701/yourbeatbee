"use client"

import * as React from "react"

const SECTIONS = [
  "[Verse]",
  "[Pre-Chorus]",
  "[Chorus]",
  "[Bridge]",
  "[Outro]",
] as const

export function LyricsEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const areaRef = React.useRef<HTMLTextAreaElement>(null)

  function insertSection(tag: string) {
    const next =
      !value.trim()
        ? `${tag}\n`
        : value.endsWith("\n")
          ? `${value}${tag}\n`
          : `${value}\n\n${tag}\n`
    onChange(next)
    requestAnimationFrame(() => {
      areaRef.current?.focus()
      const pos = next.length
      areaRef.current?.setSelectionRange(pos, pos)
    })
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="meta-caps text-bee">02 — Lyrics</p>
        <h2 className="display-section mt-2">Write the words</h2>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          Hindi or English. Structure with verse and chorus tags if you like.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {SECTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => insertSection(tag)}
              className="meta-caps text-text-muted transition-colors hover:text-bee"
            >
              {tag}
            </button>
          ))}
        </div>
        <textarea
          ref={areaRef}
          id="lyrics"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          placeholder={
            "[Verse]\nTum paas ho\naur waqt thehra sa lage\n\n[Chorus]\nDil yeh kahe, tu hi meri manzil"
          }
          className="min-h-[280px] w-full resize-y border-0 border-y border-border bg-transparent px-0 py-8 text-lg leading-[1.7] text-foreground placeholder:text-text-muted/60 focus:outline-none"
        />
      </div>
    </section>
  )
}
