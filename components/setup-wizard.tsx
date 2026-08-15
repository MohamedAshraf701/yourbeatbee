"use client"

import * as React from "react"
import { toast } from "sonner"

import { DIT_MODELS, LM_MODELS } from "@/lib/models"
import type { DitModelId, LmModelId } from "@/lib/models"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type SystemInfo = {
  os: string
  arch: string
  ramGb: number
  device: string
  backend: string
  cudaVramGb: number | null
  vendorReady: boolean
  rvcReady: boolean
}

type Recommendation = {
  ditModel: DitModelId
  lmModel: LmModelId
  backend: string
  device: string
  saveMemory: boolean
  reason: string
  warnings: string[]
  advancedLm: LmModelId | null
}

type SetupStatus = {
  running: boolean
  step: string
  message: string
  error: string | null
  logTail: string
}

type Step = "detect" | "models" | "install" | "engine"

export function SetupWizard({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}) {
  const [step, setStep] = React.useState<Step>("detect")
  const [loading, setLoading] = React.useState(false)
  const [system, setSystem] = React.useState<SystemInfo | null>(null)
  const [recommendation, setRecommendation] =
    React.useState<Recommendation | null>(null)
  const [ditModel, setDitModel] = React.useState<DitModelId>("acestep-v15-turbo")
  const [lmModel, setLmModel] = React.useState<LmModelId>("acestep-5Hz-lm-0.6B")
  const [status, setStatus] = React.useState<SetupStatus | null>(null)
  const [engineMsg, setEngineMsg] = React.useState("")
  const [loadPct, setLoadPct] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!open) {
      setStep("detect")
      setLoading(false)
      setStatus(null)
      setEngineMsg("")
      return
    }
    void loadSystem()
  }, [open])

  async function loadSystem() {
    setLoading(true)
    try {
      const res = await fetch("/api/setup/system")
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Could not probe system")
      }
      setSystem(data.system as SystemInfo)
      const rec = data.recommendation as Recommendation
      setRecommendation(rec)
      setDitModel(rec.ditModel)
      setLmModel(rec.lmModel)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Probe failed")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (step !== "install") {
      return
    }
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/setup/status")
        const data = (await res.json()) as SetupStatus
        if (cancelled) {
          return
        }
        setStatus(data)
        if (!data.running && data.step === "done") {
          clearInterval(timer)
          setStep("engine")
        }
        if (!data.running && data.step === "error") {
          clearInterval(timer)
          toast.error(data.error || "Install failed")
        }
      } catch {
        // ignore
      }
    }, 1500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [step])

  async function startInstall() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch("/api/setup/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ditModel, lmModel, mode: "full" }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Could not start install")
      }
      setStatus(data as SetupStatus)
      setStep("install")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Install failed")
    } finally {
      setLoading(false)
    }
  }

  async function startEngine() {
    setLoading(true)
    setEngineMsg("Starting engine…")
    try {
      await fetch("/api/setup/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ditModel,
          lmModel,
          backend: recommendation?.backend ?? "auto",
          device: recommendation?.device ?? "auto",
          saveMemory: recommendation?.saveMemory ?? true,
          setupComplete: true,
        }),
      })
      const res = await fetch("/api/setup/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Could not start engine")
      }

      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const healthRes = await fetch("/api/health")
        const health = await healthRes.json()
        if (typeof health.progress === "number") {
          setLoadPct(health.progress)
        }
        if (health.ready) {
          setEngineMsg("Engine ready.")
          setLoadPct(100)
          toast.success("Setup complete — engine is ready.")
          onComplete()
          onOpenChange(false)
          return
        }
        setEngineMsg(
          health.message ||
            health.error ||
            `Waiting for model load… (${i + 1})`
        )
      }
      toast("Engine is starting. Watch the badge — generate when it shows ready.")
      onComplete()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Engine start failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 border-border bg-elevated p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg font-medium tracking-tight">
            Welcome to YourBeatBee
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Detect this machine, pick models, install from the browser, then
            start the local engine.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {(
              [
                ["detect", "1 · Detect"],
                ["models", "2 · Models"],
                ["install", "3 · Install"],
                ["engine", "4 · Engine"],
              ] as const
            ).map(([id, label]) => (
              <Badge
                key={id}
                variant={step === id ? "secondary" : "outline"}
              >
                {label}
              </Badge>
            ))}
          </div>

          {step === "detect" ? (
            <div className="flex flex-col gap-4 text-sm">
              {loading && !system ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Spinner /> Probing hardware…
                </div>
              ) : system ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <dt className="text-muted-foreground">Device</dt>
                    <dd className="font-medium uppercase">{system.device}</dd>
                    <dt className="text-muted-foreground">RAM</dt>
                    <dd className="font-medium">~{system.ramGb} GB</dd>
                    <dt className="text-muted-foreground">Backend</dt>
                    <dd className="font-medium">{system.backend}</dd>
                    <dt className="text-muted-foreground">OS</dt>
                    <dd className="font-medium">
                      {system.os} · {system.arch}
                    </dd>
                    {system.cudaVramGb != null ? (
                      <>
                        <dt className="text-muted-foreground">VRAM</dt>
                        <dd className="font-medium">
                          ~{system.cudaVramGb.toFixed(0)} GB
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {recommendation ? (
                    <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                      {recommendation.reason}
                    </p>
                  ) : null}
                  {recommendation?.warnings?.map((w) => (
                    <p key={w} className="text-xs text-muted-foreground">
                      {w}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground">Could not read system info.</p>
              )}
            </div>
          ) : null}

          {step === "models" ? (
            <div className="flex flex-col gap-5">
              <ModelPicker
                title="DiT"
                options={DIT_MODELS}
                value={ditModel}
                recommended={recommendation?.ditModel}
                onChange={(id) => setDitModel(id as DitModelId)}
              />
              <ModelPicker
                title="Language model"
                options={LM_MODELS}
                value={lmModel}
                recommended={recommendation?.lmModel}
                advanced={recommendation?.advancedLm ?? undefined}
                onChange={(id) => setLmModel(id as LmModelId)}
              />
            </div>
          ) : null}

          {step === "install" ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                {status?.running !== false || status?.step === "install" ? (
                  <Spinner />
                ) : null}
                <span>{status?.message || "Installing…"}</span>
              </div>
              {status?.error ? (
                <p className="text-sm text-destructive">{status.error}</p>
              ) : null}
              {status?.logTail ? (
                <pre className="max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {status.logTail}
                </pre>
              ) : null}
            </div>
          ) : null}

          {step === "engine" ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                Install finished. Start the engine with your selected models (
                {ditModel.replace("acestep-", "")} +{" "}
                {lmModel.replace("acestep-5Hz-lm-", "")}).
              </p>
              {engineMsg ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  {loading ? <Spinner /> : null}
                  {engineMsg}
                </p>
              ) : null}
              {typeof loadPct === "number" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-foreground/70 transition-all"
                      style={{ width: `${loadPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Model load {loadPct}%
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          {step === "detect" ? (
            <Button
              onClick={() => setStep("models")}
              disabled={!system || loading}
            >
              Continue
            </Button>
          ) : null}
          {step === "models" ? (
            <>
              <Button variant="outline" onClick={() => setStep("detect")}>
                Back
              </Button>
              <Button onClick={() => void startInstall()} disabled={loading}>
                {loading ? <Spinner data-icon="inline-start" /> : null}
                Install
              </Button>
            </>
          ) : null}
          {step === "install" ? (
            <Button
              variant="outline"
              disabled={status?.running}
              onClick={() => setStep("models")}
            >
              Back
            </Button>
          ) : null}
          {step === "engine" ? (
            <Button onClick={() => void startEngine()} disabled={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : null}
              Start engine
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModelPicker({
  title,
  options,
  value,
  recommended,
  advanced,
  onChange,
}: {
  title: string
  options: readonly { id: string; label: string; blurb: string }[]
  value: string
  recommended?: string
  advanced?: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-2xl border px-3 py-2.5 text-left transition-colors",
              value === opt.id
                ? "border-bee/50 bg-bee/5"
                : "border-border hover:border-white/15"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{opt.label}</span>
              {recommended === opt.id ? (
                <Badge variant="secondary">Recommended</Badge>
              ) : null}
              {advanced === opt.id ? (
                <Badge variant="outline">Advanced</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
