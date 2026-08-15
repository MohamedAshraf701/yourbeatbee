"use client"

import type { EngineHealth } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EngineSettingsForm } from "@/components/studio/engine-settings"

export function SettingsPanel({
  open,
  onOpenChange,
  health,
  onOpenWizard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  health: EngineHealth | null
  onOpenWizard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 border-border bg-elevated p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg font-medium tracking-tight">
            YourBeatBee Engine
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Configure the local AI models powering your studio.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <EngineSettingsForm
            health={health}
            onOpenWizard={onOpenWizard}
            onDone={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
