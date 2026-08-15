"use client"

import { cn } from "@/lib/utils"

/** Full-bleed frequency atmosphere — alive even when idle. */
export function AudioField({
  active = false,
  intensity = 0.45,
  className,
  lines = 36,
}: {
  active?: boolean
  intensity?: number
  className?: string
  lines?: number
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute inset-y-[12%] left-0 flex w-[200%] items-center gap-px opacity-70"
        style={{
          animation: `freq-scroll ${active ? 7 : 18}s linear infinite`,
          opacity: 0.25 + intensity * 0.45,
        }}
      >
        {Array.from({ length: lines * 2 }).map((_, i) => {
          const h =
            18 +
            Math.abs(Math.sin(i * 0.37)) * 42 +
            Math.abs(Math.cos(i * 0.19)) * 28
          return (
            <span
              key={i}
              className="w-px flex-none rounded-full bg-foreground/80 origin-center"
              style={{
                height: `${h}%`,
                opacity: 0.15 + (i % 5) * 0.05,
                  background:
                  i % 9 === 0
                    ? "var(--bee)"
                    : "color-mix(in srgb, var(--foreground) 55%, transparent)",
                animation: active
                  ? `soft-pulse ${0.7 + (i % 6) * 0.1}s ease-in-out infinite`
                  : undefined,
                animationDelay: `${(i % 12) * 40}ms`,
              }}
            />
          )
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-80" />
    </div>
  )
}
