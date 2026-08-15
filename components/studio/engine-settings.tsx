"use client"

import * as React from "react"
import { toast } from "sonner"

import { DIT_MODELS, LM_MODELS } from "@/lib/models"
import type { BackendId, DeviceId, DitModelId, LmModelId } from "@/lib/models"
import type { EngineHealth } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function EngineSettingsView({
  health,
  onOpenWizard,
}: {
  health: EngineHealth | null
  onOpenWizard: () => void
}) {
  return (
    <div className="flex flex-col gap-12 pb-16 pt-4">
      <header className="max-w-3xl">
        <p className="meta-caps text-bee">Engine</p>
        <h1 className="display-hero mt-4 text-[clamp(2.75rem,7vw,5.5rem)]">
          Local
          <br />
          AI.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-text-secondary">
          Configure the models powering your studio — kept readable for
          musicians, with technical detail when you need it.
        </p>
      </header>
      <EngineSettingsForm health={health} onOpenWizard={onOpenWizard} />
    </div>
  )
}

export function EngineSettingsForm({
  health,
  onOpenWizard,
  onDone,
}: {
  health: EngineHealth | null
  onOpenWizard: () => void
  onDone?: () => void
}) {
  const [ditModel, setDitModel] = React.useState<DitModelId>("acestep-v15-turbo")
  const [lmModel, setLmModel] = React.useState<LmModelId>("acestep-5Hz-lm-0.6B")
  const [backend, setBackend] = React.useState<BackendId>("auto")
  const [device, setDevice] = React.useState<DeviceId>("auto")
  const [saveMemory, setSaveMemory] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [downloadLog, setDownloadLog] = React.useState("")
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/setup/settings")
        const data = await res.json()
        if (!res.ok) return
        setDitModel(data.ditModel)
        setLmModel(data.lmModel)
        setBackend(data.backend)
        setDevice(data.device)
        setSaveMemory(Boolean(data.saveMemory))
      } catch {
        // ignore
      }
    })()
  }, [])

  async function stopEngine() {
    setBusy(true)
    try {
      const res = await fetch("/api/setup/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      })
      if (!res.ok) throw new Error("Could not stop engine")
      toast("Engine stopped — models unloaded.")
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stop failed")
    } finally {
      setBusy(false)
    }
  }

  async function startEngine() {
    setBusy(true)
    try {
      const res = await fetch("/api/setup/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })
      if (!res.ok) throw new Error("Could not start engine")
      toast("Engine starting — wait for the ready badge.")
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Start failed")
    } finally {
      setBusy(false)
    }
  }

  async function applyAndRestart(opts?: { download?: boolean }) {
    setBusy(true)
    setDownloadLog("")
    try {
      const saveRes = await fetch("/api/setup/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ditModel,
          lmModel,
          backend,
          device,
          saveMemory,
          setupComplete: true,
        }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json()
        throw new Error(err.error || "Could not save settings")
      }

      if (opts?.download) {
        const installRes = await fetch("/api/setup/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ditModel, lmModel, mode: "models" }),
        })
        const installData = await installRes.json()
        if (!installRes.ok) {
          throw new Error(installData.error || "Download failed to start")
        }
        for (let i = 0; i < 600; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const st = await fetch("/api/setup/status")
          const status = await st.json()
          setDownloadLog(status.logTail || status.message || "")
          if (!status.running) {
            if (status.step === "error") {
              throw new Error(status.error || "Download failed")
            }
            break
          }
        }
      }

      const eng = await fetch("/api/setup/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      })
      const engData = await eng.json()
      if (!eng.ok) throw new Error(engData.error || "Restart failed")
      toast.success("Settings saved. Engine restarting.")
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed")
    } finally {
      setBusy(false)
    }
  }

  const recommendation = health?.recommendation
  const ready = Boolean(health?.ready)

  return (
    <div className="flex max-w-2xl flex-col gap-12">
      <div className="flex items-center gap-3 border-b border-border pb-6">
        <span
          className={
            ready ? "size-2 rounded-full bg-bee" : "size-2 rounded-full bg-text-muted"
          }
        />
        <p className="meta-caps">{ready ? "Ready" : health?.alive ? "Loading" : "Offline"}</p>
        {health?.system ? (
          <p className="meta-caps ml-auto text-text-muted">
            {health.system.backend.toUpperCase()} · {health.system.device.toUpperCase()}
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <p className="meta-caps">Music model</p>
        <ModelRows
          options={DIT_MODELS.map((m) => ({
            ...m,
            description: m.id.includes("turbo")
              ? "Faster generation · Lower memory"
              : "Stronger style following · More memory",
          }))}
          value={ditModel}
          recommended={recommendation?.ditModel}
          onChange={(id) => setDitModel(id as DitModelId)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <p className="meta-caps">Language model</p>
        <ModelRows
          options={LM_MODELS.map((m) => ({
            ...m,
            description: m.id.includes("0.6B")
              ? "Optimized for Apple Silicon"
              : m.id.includes("1.7B")
                ? "Higher quality"
                : "Highest quality · Needs more memory",
          }))}
          value={lmModel}
          recommended={recommendation?.lmModel}
          advanced={recommendation?.advancedLm ?? undefined}
          onChange={(id) => setLmModel(id as LmModelId)}
        />
      </section>

      <label className="flex cursor-pointer items-start gap-3 border-y border-border py-6">
        <input
          type="checkbox"
          checked={saveMemory}
          onChange={(e) => setSaveMemory(e.target.checked)}
          className="mt-1 size-4 accent-bee"
        />
        <span>
          <span className="meta-caps text-foreground">Memory optimized</span>
          <span className="mt-1 block text-xs text-text-muted">
            Recommended on Apple Silicon
          </span>
        </span>
      </label>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="meta-caps text-text-muted hover:text-foreground"
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
        {showAdvanced ? (
          <div className="mt-6 flex flex-col gap-6 border border-border p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldSelect
                label="Backend"
                value={backend}
                options={[
                  { id: "auto", label: "Auto" },
                  { id: "mlx", label: "MLX" },
                  { id: "pt", label: "PyTorch" },
                ]}
                onChange={(v) => setBackend(v as BackendId)}
              />
              <FieldSelect
                label="Device"
                value={device}
                options={[
                  { id: "auto", label: "Auto" },
                  { id: "mps", label: "MPS" },
                  { id: "cuda", label: "CUDA" },
                  { id: "cpu", label: "CPU" },
                ]}
                onChange={(v) => setDevice(v as DeviceId)}
              />
            </div>
            <dl className="grid gap-2 text-xs text-text-secondary">
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">DiT id</dt>
                <dd className="truncate font-mono">{ditModel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">LM id</dt>
                <dd className="truncate font-mono">{lmModel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Loaded</dt>
                <dd className="truncate font-mono">{health?.lm || "—"}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      {downloadLog ? (
        <pre className="max-h-40 overflow-auto border border-border p-3 font-mono text-[11px] whitespace-pre-wrap text-text-muted">
          {downloadLog}
        </pre>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={onOpenWizard}
          disabled={busy}
          className="meta-caps text-text-secondary hover:text-foreground disabled:opacity-40"
        >
          First-run wizard
        </button>
        {!health?.alive && !ready ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startEngine()}
            className="meta-caps text-bee hover:underline disabled:opacity-40"
          >
            Start engine
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !health?.alive}
          onClick={() => void stopEngine()}
          className="meta-caps text-text-secondary hover:text-foreground disabled:opacity-40"
        >
          Stop / unload
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void applyAndRestart({ download: true })}
          className="inline-flex items-center gap-2 meta-caps text-text-secondary hover:text-foreground disabled:opacity-40"
        >
          {busy ? <Spinner className="size-3.5" /> : null}
          Download &amp; apply
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void applyAndRestart()}
          className="inline-flex items-center gap-2 border border-bee/40 bg-bee px-5 py-3 meta-caps text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Spinner className="size-3.5" /> : null}
          Apply &amp; restart
        </button>
      </div>
    </div>
  )
}

function ModelRows({
  options,
  value,
  recommended,
  advanced,
  onChange,
}: {
  options: readonly {
    id: string
    label: string
    blurb: string
    description?: string
  }[]
  value: string
  recommended?: string
  advanced?: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-col">
      {options.map((opt) => {
        const selected = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex flex-col gap-2 border-b border-border py-5 text-left transition-colors",
              selected ? "border-bee" : "hover:border-foreground/20"
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  selected ? "bg-bee" : "bg-transparent ring-1 ring-foreground/25"
                )}
              />
              <span className="text-base font-medium tracking-tight">{opt.label}</span>
              {recommended === opt.id ? (
                <span className="meta-caps text-bee">Recommended</span>
              ) : null}
              {advanced === opt.id ? (
                <span className="meta-caps text-text-muted">Advanced</span>
              ) : null}
            </div>
            <p className="pl-4 text-xs text-text-muted">
              {opt.description || opt.blurb}
            </p>
          </button>
        )
      })}
    </div>
  )
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="meta-caps">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 border border-border bg-transparent px-3 text-sm outline-none focus:border-bee/40"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
