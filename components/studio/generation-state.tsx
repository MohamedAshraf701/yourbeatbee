"use client"

import type { Job } from "@/lib/types"
import { cn } from "@/lib/utils"

const STAGES = [
  { key: "melody", label: "Melody" },
  { key: "rhythm", label: "Rhythm" },
  { key: "vocals", label: "Vocals" },
  { key: "mix", label: "Mix" },
] as const

/** Map engine job.phase / progress onto the four studio stages. */
function stageIndex(job: Job | null) {
  if (!job || job.status === "queued") return 0
  const phase = (job.phase || "").toLowerCase()
  if (phase === "preparing" || phase === "lyrics") return 0
  if (phase === "generating") return 1
  if (phase === "rvc") return 2
  if (phase === "saving" || phase === "done") return 3

  const blob = `${phase} ${job.message || ""}`.toLowerCase()
  if (/lyric|lm|caption|prompt|compose|prepar/.test(blob)) return 0
  if (/generat|diffus|dit|ode|sde/.test(blob)) return 1
  if (/vocal|voice|rvc|demucs|separat/.test(blob)) return 2
  if (/mix|save|decode|render|audio|export|write/.test(blob)) return 3

  const p = typeof job.progress === "number" ? job.progress : 40
  if (p < 25) return 0
  if (p < 55) return 1
  if (p < 82) return 2
  return 3
}

export function GenerationState({
  job,
  progress,
}: {
  job: Job | null
  progress: number
}) {
  const active = stageIndex(job)

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden border-y border-bee/30 py-14"
    >
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center opacity-50"
      >
        <div
          className="flex h-40 w-[160%] items-center gap-px"
          style={{ animation: "freq-scroll 6s linear infinite" }}
        >
          {Array.from({ length: 100 }).map((_, i) => (
            <span
              key={i}
              className="w-px flex-1 bg-bee origin-center"
              style={{
                height: `${12 + Math.abs(Math.sin(i * 0.28 + progress * 0.04)) * 78}%`,
                opacity: 0.25 + (i % 4) * 0.1,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-10 text-center">
        <div>
          <p className="meta-caps text-bee">Creating your song</p>
          <p className="mt-4 text-sm text-text-secondary">
            {job?.message || "The studio is writing sound…"}
          </p>
        </div>

        <ul className="flex w-full flex-col gap-4">
          {STAGES.map((stage, i) => {
            const done = i < active
            const current = i === active
            return (
              <li
                key={stage.key}
                className={cn(
                  "flex items-center justify-between gap-4 border-b border-border/60 pb-3 meta-caps",
                  current
                    ? "text-foreground"
                    : done
                      ? "text-text-secondary"
                      : "text-text-muted"
                )}
              >
                <span>{stage.label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      done || current ? "bg-bee" : "border border-foreground/25",
                      current && "animate-pulse"
                    )}
                  />
                  {done ? "Complete" : current ? "Processing" : "Waiting"}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="text-xs tabular-nums text-text-muted">
          {Math.round(progress)}%
          {job?.phase ? ` · ${job.phase}` : ""}
        </p>
      </div>
    </div>
  )
}
