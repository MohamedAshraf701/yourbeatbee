"use client"

import * as React from "react"
import { MicIcon, RotateCcwIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"

import {
  MIN_VOICE_SECONDS,
  TARGET_VOICE_SECONDS,
  VOICE_SCRIPTS,
  type VoiceScript,
} from "@/lib/voice-scripts"
import type { VoiceProfileInfo } from "@/lib/types"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Step = "script" | "ready" | "record" | "review"

function pickMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ]
  for (const type of types) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type
    }
  }
  return ""
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function VoiceSetupDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (profile: VoiceProfileInfo) => void
}) {
  const [step, setStep] = React.useState<Step>("script")
  const [scriptId, setScriptId] = React.useState(VOICE_SCRIPTS[0]!.id)
  const [lineIndex, setLineIndex] = React.useState(0)
  const [elapsed, setElapsed] = React.useState(0)
  const [countdown, setCountdown] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [blob, setBlob] = React.useState<Blob | null>(null)

  const mediaRef = React.useRef<MediaStream | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<BlobPart[]>([])
  const timerRef = React.useRef<number | null>(null)
  const lineTimerRef = React.useRef<number | null>(null)

  const script = VOICE_SCRIPTS.find((item) => item.id === scriptId) ?? VOICE_SCRIPTS[0]!

  const cleanupStream = React.useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (lineTimerRef.current) {
      window.clearInterval(lineTimerRef.current)
      lineTimerRef.current = null
    }
    recorderRef.current = null
    mediaRef.current?.getTracks().forEach((track) => track.stop())
    mediaRef.current = null
  }, [])

  const resetSession = React.useCallback(() => {
    cleanupStream()
    setElapsed(0)
    setLineIndex(0)
    setCountdown(null)
    setBlob(null)
    setPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
  }, [cleanupStream])

  React.useEffect(() => {
    if (!open) {
      resetSession()
      setStep("script")
      return
    }
  }, [open, resetSession])

  React.useEffect(() => {
    return () => {
      cleanupStream()
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [cleanupStream, previewUrl])

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (lineTimerRef.current) {
      window.clearInterval(lineTimerRef.current)
      lineTimerRef.current = null
    }
  }

  async function startRecording() {
    resetSession()
    setStep("record")
    setCountdown(3)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaRef.current = stream

      await new Promise<void>((resolve) => {
        let remaining = 3
        setCountdown(remaining)
        const tick = window.setInterval(() => {
          remaining -= 1
          if (remaining <= 0) {
            window.clearInterval(tick)
            setCountdown(null)
            resolve()
            return
          }
          setCountdown(remaining)
        }, 1000)
      })

      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm"
        const nextBlob = new Blob(chunksRef.current, { type })
        setBlob(nextBlob)
        setPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev)
          }
          return URL.createObjectURL(nextBlob)
        })
        mediaRef.current?.getTracks().forEach((track) => track.stop())
        mediaRef.current = null
        setStep("review")
      }

      recorder.start(1000)
      setElapsed(0)
      setLineIndex(0)

      timerRef.current = window.setInterval(() => {
        setElapsed((value) => {
          const next = value + 1
          if (next >= TARGET_VOICE_SECONDS + 30) {
            stopRecording()
          }
          return next
        })
      }, 1000)

      // Advance lyric lines every ~9 seconds while singing.
      lineTimerRef.current = window.setInterval(() => {
        setLineIndex((index) =>
          Math.min(index + 1, Math.max(0, script.lines.length - 1))
        )
      }, 9000)
    } catch {
      cleanupStream()
      setStep("ready")
      toast.error("Microphone permission is required to set up your voice.")
    }
  }

  async function saveRecording() {
    if (!blob) {
      return
    }
    if (elapsed < MIN_VOICE_SECONDS) {
      toast.error(
        `Sing for at least ${Math.ceil(MIN_VOICE_SECONDS / 60)} minutes. You recorded ${formatTime(elapsed)}.`
      )
      return
    }

    setSaving(true)
    try {
      const extension = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm"
      const file = new File([blob], `my-voice.${extension}`, {
        type: blob.type || "audio/webm",
      })
      const body = new FormData()
      body.set("file", file)
      const res = await fetch("/api/voice", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Could not save voice.")
        return
      }
      onSaved(data as VoiceProfileInfo)
      onOpenChange(false)
      toast.success("Voice saved. You can generate with My Voice now.")
    } catch {
      toast.error("Could not save voice.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>Set up My Voice</DialogTitle>
          <DialogDescription>
            Sing the guided lines clearly for about 2–3 minutes. We convert that
            recording into a voice reference that steers the singer&apos;s
            timbre — it won&apos;t be a perfect clone of you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          {step === "script" ? (
            <ScriptStep
              script={script}
              scriptId={scriptId}
              onScriptId={setScriptId}
              onContinue={() => setStep("ready")}
            />
          ) : null}

          {step === "ready" ? (
            <ReadyStep
              script={script}
              onBack={() => setStep("script")}
              onStart={() => void startRecording()}
            />
          ) : null}

          {step === "record" ? (
            <RecordStep
              script={script}
              lineIndex={lineIndex}
              elapsed={elapsed}
              countdown={countdown}
              onStop={stopRecording}
            />
          ) : null}

          {step === "review" ? (
            <ReviewStep
              elapsed={elapsed}
              previewUrl={previewUrl}
              saving={saving}
              onRetake={() => {
                resetSession()
                setStep("ready")
              }}
              onSave={() => void saveRecording()}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScriptStep({
  script,
  scriptId,
  onScriptId,
  onContinue,
}: {
  script: VoiceScript
  scriptId: string
  onScriptId: (id: string) => void
  onContinue: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Choose a script</p>
        <ToggleGroup
          value={[scriptId]}
          onValueChange={(value) => {
            if (value[0]) {
              onScriptId(value[0])
            }
          }}
          spacing={2}
        >
          {VOICE_SCRIPTS.map((item) => (
            <ToggleGroupItem key={item.id} value={item.id}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <p className="text-xs text-muted-foreground">{script.tip}</p>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 p-3">
        <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
          {script.lines.slice(0, 5).map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>…</li>
        </ol>
      </div>
      <DialogFooter className="px-0">
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </DialogFooter>
    </div>
  )
}

function ReadyStep({
  script,
  onBack,
  onStart,
}: {
  script: VoiceScript
  onBack: () => void
  onStart: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-medium">Before you start</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>Quiet room, phone or laptop mic is fine</li>
          <li>Sing the lines on screen — don’t whisper</li>
          <li>Keep going for about {Math.round(TARGET_VOICE_SECONDS / 60)} minutes</li>
          <li>Script: {script.label}</li>
        </ul>
      </div>
      <DialogFooter className="gap-2 px-0 sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onStart}>
          <MicIcon data-icon="inline-start" />
          Start recording
        </Button>
      </DialogFooter>
    </div>
  )
}

function RecordStep({
  script,
  lineIndex,
  elapsed,
  countdown,
  onStop,
}: {
  script: VoiceScript
  lineIndex: number
  elapsed: number
  countdown: number | null
  onStop: () => void
}) {
  const current = script.lines[lineIndex] ?? script.lines.at(-1) ?? ""
  const upcoming = script.lines[lineIndex + 1]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">
          {countdown !== null ? "Get ready" : "Recording"}
        </Badge>
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          {formatTime(elapsed)} / ~{formatTime(TARGET_VOICE_SECONDS)}
        </p>
      </div>

      {countdown !== null ? (
        <div className="flex min-h-40 items-center justify-center">
          <p className="font-heading text-6xl tracking-tight">{countdown}</p>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col justify-center gap-3 rounded-xl border border-border/70 bg-muted/15 p-5 text-center">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Sing this line
          </p>
          <p className="font-heading text-xl leading-snug md:text-2xl">
            {current}
          </p>
          {upcoming ? (
            <p className="text-sm text-muted-foreground">Next: {upcoming}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Last lines — keep singing until you stop.
            </p>
          )}
        </div>
      )}

      <DialogFooter className="px-0">
        <Button
          type="button"
          variant="outline"
          onClick={onStop}
          disabled={countdown !== null}
        >
          <SquareIcon data-icon="inline-start" />
          Stop & review
        </Button>
      </DialogFooter>
    </div>
  )
}

function ReviewStep({
  elapsed,
  previewUrl,
  saving,
  onRetake,
  onSave,
}: {
  elapsed: number
  previewUrl: string | null
  saving: boolean
  onRetake: () => void
  onSave: () => void
}) {
  const longEnough = elapsed >= MIN_VOICE_SECONDS

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={longEnough ? "secondary" : "outline"}>
          {formatTime(elapsed)} recorded
        </Badge>
        {!longEnough ? (
          <p className="text-xs text-muted-foreground">
            Aim for at least {formatTime(MIN_VOICE_SECONDS)}. Retake if needed.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sounds good — save it.</p>
        )}
      </div>
      {previewUrl ? (
        <audio className="w-full" controls src={previewUrl} />
      ) : null}
      <DialogFooter className="gap-2 px-0 sm:justify-between">
        <Button type="button" variant="ghost" onClick={onRetake} disabled={saving}>
          <RotateCcwIcon data-icon="inline-start" />
          Retake
        </Button>
        <Button type="button" onClick={onSave} disabled={saving || !longEnough}>
          {saving ? <Spinner data-icon="inline-start" /> : null}
          {saving ? "Saving…" : "Save voice"}
        </Button>
      </DialogFooter>
    </div>
  )
}
