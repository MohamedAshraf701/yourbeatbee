"use client"

import { ArrowRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

export function GenerateButton({
  busy,
  disabled,
  className,
}: {
  busy: boolean
  disabled: boolean
  className?: string
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "group relative flex w-full items-center justify-center overflow-hidden border border-bee/50 bg-bee text-primary-foreground",
        "min-h-[4.5rem] px-8 transition-all duration-200",
        "hover:brightness-105",
        "active:translate-y-px",
        "focus-visible:ring-2 focus-visible:ring-bee/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:brightness-100",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-end gap-px opacity-0 transition-opacity duration-200 group-hover:opacity-70 group-disabled:opacity-0"
      >
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="flex-1 bg-primary-foreground/40 origin-bottom"
            style={{
              height: `${20 + Math.abs(Math.sin(i * 0.5)) * 80}%`,
              animation: `soft-pulse ${0.45 + (i % 5) * 0.08}s ease-in-out infinite`,
            }}
          />
        ))}
      </span>
      <span className="relative z-10 flex items-center gap-4 meta-caps tracking-[0.28em] text-sm sm:text-base">
        {busy ? <Spinner className="size-4" /> : null}
        {busy ? "Creating" : "Create the song"}
        {!busy ? (
          <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        ) : null}
      </span>
    </button>
  )
}
