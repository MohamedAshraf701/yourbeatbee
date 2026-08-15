"use client"

import type { Language } from "@/lib/types"
import { cn } from "@/lib/utils"

const OPTIONS: { id: Language; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "hi", label: "Hindi" },
  { id: "en", label: "English" },
]

export function LanguageSelector({
  value,
  onChange,
}: {
  value: Language
  onChange: (value: Language) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="meta-caps" id="language-label">
        Language
      </p>
      <div role="radiogroup" aria-labelledby="language-label" className="flex gap-5">
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
