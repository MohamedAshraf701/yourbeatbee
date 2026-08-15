"use client"

import { BrandLogo } from "@/components/studio/brand-logo"
import { EngineStatus } from "@/components/studio/engine-status"
import { ThemeToggle } from "@/components/studio/theme-toggle"
import { STUDIO_NAV, type StudioView } from "@/components/studio/types"
import { BRAND_NAME } from "@/lib/brand"
import type { EngineHealth } from "@/lib/types"
import { SettingsIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function TopNavigation({
  view,
  onViewChange,
  health,
  generating,
  onOpenEngine,
  onOpenSettings,
  onStopEngine,
}: {
  view: StudioView
  onViewChange: (view: StudioView) => void
  health: EngineHealth | null
  generating: boolean
  onOpenEngine: () => void
  onOpenSettings: () => void
  onStopEngine: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-6 py-5">
      <div className="flex min-w-0 items-center gap-8 lg:gap-12">
        <button
          type="button"
          onClick={() => onViewChange("create")}
          className="group flex items-center gap-3"
        >
          <BrandLogo variant="mark" size={28} priority className="shrink-0" />
          <span className="meta-caps text-foreground transition-opacity group-hover:opacity-80">
            {BRAND_NAME}
          </span>
        </button>

        <nav aria-label="Studio" className="hidden items-center gap-5 sm:flex">
          {STUDIO_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={view === item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "nav-underline meta-caps pb-0.5 transition-colors",
                view === item.id
                  ? "text-foreground"
                  : "text-text-muted hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <EngineStatus
          health={health}
          generating={generating}
          onConfigure={onOpenEngine}
          onStop={onStopEngine}
        />
        <ThemeToggle />
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="flex size-9 items-center justify-center text-text-muted transition-colors hover:text-foreground"
        >
          <SettingsIcon className="size-4" strokeWidth={1.5} />
        </button>
        <div
          aria-hidden
          className="hidden size-8 items-center justify-center border border-border text-[9px] tracking-[0.18em] text-text-muted sm:flex"
          title="Local profile"
        >
          YOU
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        aria-label="Studio mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 px-2 py-2 backdrop-blur-md sm:hidden"
      >
        {STUDIO_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            className={cn(
              "flex-1 py-2 text-center text-[10px] tracking-[0.16em] uppercase",
              view === item.id ? "text-bee" : "text-text-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
