"use client"

import { cn } from "@/lib/utils"

const OPTIONS = [
  { id: "30", label: "30s" },
  { id: "60", label: "1m" },
  { id: "120", label: "2m" },
  { id: "300", label: "5m" },
  { id: "auto", label: "Auto" },
] as const

export function DurationSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="meta-caps" id="duration-label">
        Duration
      </p>
      <div
        role="radiogroup"
        aria-labelledby="duration-label"
        className="flex flex-wrap gap-5"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            data-active={value === opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "nav-underline meta-caps pb-0.5",
              value === opt.id ? "text-foreground" : "text-text-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
