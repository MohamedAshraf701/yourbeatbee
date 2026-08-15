"use client"

import { AudioField } from "@/components/studio/audio-field"
import { TopNavigation } from "@/components/studio/top-navigation"
import type { StudioView } from "@/components/studio/types"
import type { EngineHealth } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AppShell({
  view,
  onViewChange,
  health,
  generating,
  onOpenEngine,
  onOpenSettings,
  onStopEngine,
  children,
  className,
}: {
  view: StudioView
  onViewChange: (view: StudioView) => void
  health: EngineHealth | null
  generating: boolean
  onOpenEngine: () => void
  onOpenSettings: () => void
  onStopEngine: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("studio-canvas", className)}>
      <AudioField
        active={generating}
        intensity={generating ? 0.85 : 0.4}
        className="fixed inset-0 z-[1] opacity-40"
      />
      <div className="studio-layer mx-auto w-full max-w-[1600px] px-5 pb-24 sm:px-8 sm:pb-10 lg:px-12">
        <TopNavigation
          view={view}
          onViewChange={onViewChange}
          health={health}
          generating={generating}
          onOpenEngine={onOpenEngine}
          onOpenSettings={onOpenSettings}
          onStopEngine={onStopEngine}
        />
        <main key={view} className="reveal-up min-h-[70svh]">
          {children}
        </main>
      </div>
    </div>
  )
}
