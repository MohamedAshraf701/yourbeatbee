"use client"

import { cn } from "@/lib/utils"

export function Waveform({
  progress = 0,
  playing = false,
  bars = 56,
  className,
  onSeek,
}: {
  progress?: number
  playing?: boolean
  bars?: number
  className?: string
  onSeek?: (ratio: number) => void
}) {
  const heights = Array.from({ length: bars }, (_, i) => {
    const wave = Math.sin(i * 0.41) * 0.32 + Math.cos(i * 0.17) * 0.22
    return 0.22 + Math.abs(wave)
  })

  return (
    <div
      role={onSeek ? "slider" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-label={onSeek ? "Seek" : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onClick={
        onSeek
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              onSeek(
                Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
              )
            }
          : undefined
      }
      onKeyDown={
        onSeek
          ? (e) => {
              if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.05))
              if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.05))
            }
          : undefined
      }
      className={cn(
        "flex h-14 w-full items-end gap-px",
        onSeek &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bee/50",
        className
      )}
    >
      {heights.map((h, i) => {
        const filled = i / bars <= progress
        return (
          <span
            key={i}
            className={cn(
              "flex-1 origin-bottom rounded-[1px] transition-colors duration-150",
              filled ? "bg-bee" : "bg-foreground/15"
            )}
            style={{
              height: `${h * 100}%`,
              animation: playing
                ? `soft-pulse ${0.5 + (i % 7) * 0.07}s ease-in-out infinite`
                : undefined,
              animationDelay: playing ? `${(i % 11) * 35}ms` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
