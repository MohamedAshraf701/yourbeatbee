"use client"

import * as React from "react"
import { ExternalLinkIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { RVC_TRAIN_GUIDE_URL } from "@/lib/voice-rvc"
import type { VoiceProfileInfo } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Step = "guide" | "import"

export function VoiceSetupDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (profile: VoiceProfileInfo) => void
}) {
  const [step, setStep] = React.useState<Step>("guide")
  const [saving, setSaving] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [indexName, setIndexName] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const indexRef = React.useRef<HTMLInputElement>(null)
  const modelFileRef = React.useRef<File | null>(null)
  const indexFileRef = React.useRef<File | null>(null)

  function resetLocal() {
    setStep("guide")
    setSaving(false)
    setFileName(null)
    setIndexName(null)
    modelFileRef.current = null
    indexFileRef.current = null
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetLocal()
    onOpenChange(next)
  }

  async function onImport() {
    const file = modelFileRef.current
    if (!file) {
      toast.error("Choose a voice model zip or .pth file first.")
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.set("file", file)
      if (indexFileRef.current) {
        form.set("index", indexFileRef.current)
      }
      const res = await fetch("/api/voice", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Import failed")
      }
      onSaved({
        ready: Boolean(data.ready),
        kind: data.kind ?? "rvc",
        filename: data.filename ?? null,
        originalName: data.originalName ?? null,
        sizeBytes: data.sizeBytes ?? null,
        uploadedAt: data.uploadedAt ?? null,
        format: data.format ?? null,
        hasIndex: Boolean(data.hasIndex),
      })
      toast.success("Voice model imported. Generate with My Voice.")
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl gap-0 border-border bg-elevated p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg font-medium tracking-tight">
            Import Voice Model
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Use your own voice in generated songs. Your model stays on this
            device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          {step === "guide" ? (
            <div className="flex flex-col gap-4 text-sm leading-relaxed text-text-secondary">
              <ol className="list-decimal space-y-3 pl-5 text-foreground">
                <li>
                  Record about <strong>10–15 minutes</strong> of clean solo
                  singing.
                </li>
                <li>
                  Train a voice model on a GPU (Colab or desktop WebUI).
                </li>
                <li>Download the export zip, then import it here.</li>
              </ol>
              <details className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-text-muted">
                <summary className="cursor-pointer text-text-secondary hover:text-foreground">
                  Advanced details
                </summary>
                <p className="mt-2 leading-relaxed">
                  Uses RVC v2 models (<code>.pth</code> + optional{" "}
                  <code>.index</code>). Training needs CUDA — not this Mac.
                  Conversion after each song runs locally.
                </p>
                <a
                  href={RVC_TRAIN_GUIDE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-bee hover:underline"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Open training guide
                </a>
              </details>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-secondary">
                Prefer a zip export. Or upload <code>.pth</code> and optional
                index separately.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,.pth,application/zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  modelFileRef.current = f
                  setFileName(f?.name ?? null)
                }}
              />
              <input
                ref={indexRef}
                type="file"
                accept=".index"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  indexFileRef.current = f
                  setIndexName(f?.name ?? null)
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-secondary hover:text-foreground"
                >
                  <UploadIcon className="size-4" />
                  {fileName || "Choose zip or .pth"}
                </button>
                <button
                  type="button"
                  onClick={() => indexRef.current?.click()}
                  className="rounded-xl px-4 py-2.5 text-sm text-text-muted hover:text-foreground"
                >
                  {indexName || "Optional .index"}
                </button>
              </div>
              <p className="text-xs text-text-muted">Supported: RVC model · ZIP</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          {step === "guide" ? (
            <>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="rounded-xl px-4 py-2.5 text-sm text-text-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep("import")}
                className="rounded-xl bg-bee px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                I have a model — import
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("guide")}
                className="rounded-xl px-4 py-2.5 text-sm text-text-secondary hover:text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving || !fileName}
                onClick={() => void onImport()}
                className="inline-flex items-center gap-2 rounded-xl bg-bee px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {saving ? <Spinner className="size-3.5" /> : null}
                {saving ? "Importing…" : "Import model"}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
