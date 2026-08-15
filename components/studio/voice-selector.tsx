"use client"

import type { Voice } from "@/lib/types"
import { cn } from "@/lib/utils"

const OPTIONS: {
  id: Voice
  label: string
  signature: number[]
}[] = [
  { id: "female", label: "Female", signature: [0.4, 0.7, 0.55, 0.9, 0.6, 0.75, 0.45] },
  { id: "male", label: "Male", signature: [0.7, 0.5, 0.85, 0.4, 0.65, 0.55, 0.8] },
  { id: "custom", label: "My Voice", signature: [0.5, 0.85, 0.35, 0.95, 0.45, 0.7, 0.6] },
  {
    id: "instrumental",
    label: "Instrumental",
    signature: [0.3, 0.45, 0.35, 0.5, 0.4, 0.55, 0.35],
  },
]

export function VoiceSelector({
  value,
  onChange,
}: {
  value: Voice
  onChange: (voice: Voice) => void
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="meta-caps text-bee">03 — Voice</p>
        <h2 className="display-section mt-2">Who sings</h2>
      </div>

      <div
        role="radiogroup"
        aria-label="Voice"
        className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4"
      >
        {OPTIONS.map((opt) => {
          const selected = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={cn(
                "group flex flex-col gap-3 border-b pb-4 text-left transition-colors",
                selected
                  ? "border-bee"
                  : "border-border hover:border-foreground/25"
              )}
            >
              <div className="flex h-8 items-end gap-0.5">
                {opt.signature.map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-1 origin-bottom rounded-[1px] transition-colors",
                      selected ? "bg-bee" : "bg-foreground/25 group-hover:bg-foreground/40"
                    )}
                    style={{
                      height: `${h * 100}%`,
                      animation: selected
                        ? `soft-pulse ${0.55 + i * 0.07}s ease-in-out infinite`
                        : undefined,
                    }}
                  />
                ))}
              </div>
              <span
                className={cn(
                  "meta-caps",
                  selected ? "text-foreground" : "text-text-muted"
                )}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
