"use client"

import * as React from "react"

import { ditDisplayName, lmDisplayName } from "@/lib/format"
import type { EngineHealth } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

export function EngineStatus({
  health,
  generating,
  onConfigure,
  onStop,
}: {
  health: EngineHealth | null
  generating: boolean
  onConfigure: () => void
  onStop: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const ready = Boolean(health?.ready)
  const alive = Boolean(health?.alive || health?.ready)
  const busy = Boolean(generating || health?.busy)
  const loading = Boolean(
    alive &&
      !ready &&
      (health?.phase === "downloading" ||
        health?.phase === "loading_dit" ||
        health?.phase === "loading_lm" ||
        health?.phase === "starting")
  )

  let label = "Offline"
  let dot = "bg-text-muted"
  if (!health) {
    label = "Checking"
    dot = "bg-bee animate-pulse"
  } else if (busy) {
    label = generating ? "Creating" : "Busy"
    dot = "bg-bee animate-pulse"
  } else if (ready) {
    label = "Local"
    dot = "bg-bee"
  } else if (loading) {
    label = "Loading"
    dot = "bg-bee animate-pulse"
  } else if (health.needsSetup) {
    label = "Setup"
    dot = "bg-bee/60"
  }

  const settings = health?.settings
  const backend =
    settings?.backend === "auto"
      ? health?.system?.backend?.toUpperCase() || "Auto"
      : (settings?.backend || health?.system?.backend || "—").toUpperCase()
  const device =
    settings?.device === "auto"
      ? (health?.device || health?.system?.device || "—").toUpperCase()
      : (settings?.device || health?.device || "—").toUpperCase()

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 meta-caps transition-colors",
          open ? "text-foreground" : "text-text-muted hover:text-foreground"
        )}
      >
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Engine status"
          className="absolute top-full right-0 z-50 mt-3 w-72 border border-border bg-elevated p-5 shadow-2xl shadow-black/20 dark:shadow-black/50"
        >
          <p className="text-sm font-medium">
            {!health
              ? "Checking…"
              : ready
                ? "Engine ready"
                : loading
                  ? "Loading models"
                  : health.needsSetup
                    ? "Setup needed"
                    : "Engine offline"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {busy
              ? health?.message || "Working…"
              : ready
                ? "Models loaded locally"
                : health?.message || health?.error || "Configure the engine"}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="meta-caps">Backend</dt>
              <dd className="mt-1">{backend}</dd>
            </div>
            <div>
              <dt className="meta-caps">Device</dt>
              <dd className="mt-1">{device}</dd>
            </div>
            <div>
              <dt className="meta-caps">DiT</dt>
              <dd className="mt-1">
                {ditDisplayName(settings?.ditModel || health?.model)}
              </dd>
            </div>
            <div>
              <dt className="meta-caps">LM</dt>
              <dd className="mt-1">
                {lmDisplayName(settings?.lmModel || health?.lm)}
              </dd>
            </div>
          </dl>

          {!health || loading || busy ? (
            <Spinner className="mt-4 size-4 text-bee" />
          ) : null}

          <div className="mt-5 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onConfigure()
              }}
              className="meta-caps text-bee hover:underline"
            >
              Configure
            </button>
            {alive ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onStop()
                }}
                className="meta-caps text-text-muted hover:text-foreground"
              >
                Stop
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
