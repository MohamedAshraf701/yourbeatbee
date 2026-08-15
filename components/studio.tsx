"use client"

import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import type {
  EngineHealth,
  Job,
  Language,
  Song,
  Voice,
  VoiceProfileInfo,
} from "@/lib/types"
import { AppShell } from "@/components/studio/app-shell"
import { CreateWorkspace } from "@/components/studio/create-workspace"
import { LibraryView } from "@/components/studio/library-view"
import { VoiceStudio } from "@/components/studio/voice-studio"
import { EngineSettingsView } from "@/components/studio/engine-settings"
import type { StudioView } from "@/components/studio/types"
import { VoiceSetupDialog } from "@/components/voice-setup"
import { SetupWizard } from "@/components/setup-wizard"
import { SettingsPanel } from "@/components/settings-panel"
import { Spinner } from "@/components/ui/spinner"

export function Studio({ initialSongs = [] }: { initialSongs?: Song[] }) {
  const [view, setView] = React.useState<StudioView>("create")
  const [style, setStyle] = React.useState("")
  const [lyrics, setLyrics] = React.useState("")
  const [voice, setVoice] = React.useState<Voice>("female")
  const [language, setLanguage] = React.useState<Language>("auto")
  const [influence, setInfluence] = React.useState(50)
  const [weirdness, setWeirdness] = React.useState(30)
  const [voiceStrength, setVoiceStrength] = React.useState(75)
  const [duration, setDuration] = React.useState("30")
  const [bpm, setBpm] = React.useState("")
  const [seed, setSeed] = React.useState("")
  const [fast, setFast] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [voiceSetupOpen, setVoiceSetupOpen] = React.useState(false)
  const [setupWizardOpen, setSetupWizardOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const setupPrompted = React.useRef(false)
  const [job, setJob] = React.useState<Job | null>(null)
  const [songs, setSongs] = React.useState<Song[]>(initialSongs)
  const [current, setCurrent] = React.useState<Song | null>(
    initialSongs[0] ?? null
  )
  const [health, setHealth] = React.useState<EngineHealth | null>(null)
  const [voiceProfile, setVoiceProfile] = React.useState<VoiceProfileInfo | null>(
    null
  )

  const refreshSongs = React.useCallback(async (selectId?: string) => {
    const res = await fetch("/api/songs")
    if (!res.ok) return
    const data = (await res.json()) as { songs: Song[] }
    setSongs(data.songs)
    setCurrent((prev) => {
      if (selectId) {
        return data.songs.find((song) => song.id === selectId) ?? prev
      }
      return prev ?? data.songs[0] ?? null
    })
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/voice")
        if (!res.ok || cancelled) return
        setVoiceProfile((await res.json()) as VoiceProfileInfo)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function pollHealth() {
      try {
        const res = await fetch("/api/health")
        const data = (await res.json()) as EngineHealth
        if (!cancelled) {
          setHealth(data)
          if (data.needsSetup && !setupPrompted.current) {
            setupPrompted.current = true
            setSetupWizardOpen(true)
          }
        }
      } catch {
        if (!cancelled) {
          setHealth({
            ready: false,
            error: "Could not reach the studio server.",
          })
        }
      }
    }
    void pollHealth()
    const timer = setInterval(() => void pollHealth(), 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function ping() {
      try {
        await fetch("/api/setup/presence", { method: "POST" })
      } catch {
        // ignore
      }
    }
    void ping()
    const timer = setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") {
        void ping()
      }
    }, 15_000)
    function onVisible() {
      if (document.visibilityState === "visible") void ping()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  async function onStopEngine() {
    try {
      const res = await fetch("/api/setup/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      })
      if (!res.ok) {
        toast.error("Could not stop engine.")
        return
      }
      toast("Engine stopped — models unloaded from memory.")
      setHealth((prev) =>
        prev
          ? {
              ...prev,
              ready: false,
              alive: false,
              busy: false,
              phase: "stopped",
              message: "Engine stopped.",
            }
          : prev
      )
    } catch {
      toast.error("Could not stop engine.")
    }
  }

  React.useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return
    let cancelled = false
    async function pollJob() {
      const res = await fetch(`/api/jobs/${job!.id}`)
      if (!res.ok) return
      const data = (await res.json()) as { job: Job; song: Song | null }
      if (cancelled) return
      setJob(data.job)
      if (data.job.status === "done" && data.song) {
        setCurrent(data.song)
        await refreshSongs(data.song.id)
        toast.success("Song ready.")
      }
      if (data.job.status === "error") {
        toast.error(data.job.error || "Generation failed.")
      }
    }
    const timer = setInterval(() => void pollJob(), 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [job, refreshSongs])

  const generating = Boolean(
    job && (job.status === "queued" || job.status === "running")
  )
  const engineReady = Boolean(health?.ready)
  const engineAlive = Boolean(health?.alive || health?.ready)
  const engineLoading = Boolean(
    engineAlive &&
      !engineReady &&
      (health?.phase === "downloading" ||
        health?.phase === "loading_dit" ||
        health?.phase === "loading_lm" ||
        health?.phase === "starting" ||
        health?.message?.toLowerCase().includes("load") ||
        health?.message?.toLowerCase().includes("download"))
  )
  const engineBusy = Boolean(health?.busy || generating)
  const busy = submitting || generating
  const customReady = Boolean(voiceProfile?.ready)

  async function onClearVoice() {
    const res = await fetch("/api/voice", { method: "DELETE" })
    if (!res.ok) {
      toast.error("Could not remove voice.")
      return
    }
    setVoiceProfile({
      ready: false,
      filename: null,
      originalName: null,
      sizeBytes: null,
      uploadedAt: null,
    })
    if (voice === "custom") setVoice("female")
    toast("Voice cleared.")
  }

  function onSelectVoice(next: Voice) {
    setVoice(next)
    if (next === "custom" && !voiceProfile?.ready) {
      setVoiceSetupOpen(true)
    }
  }

  async function onGenerate(event: React.FormEvent) {
    event.preventDefault()
    if (!style.trim() && !lyrics.trim()) {
      toast.error("Enter a song idea, lyrics, or both.")
      return
    }
    if (voice === "custom" && !customReady) {
      toast.error("Import your voice model first.")
      setVoiceSetupOpen(true)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style,
          lyrics,
          voice,
          language,
          influence,
          weirdness,
          voiceStrength,
          duration: duration === "auto" ? -1 : Number(duration),
          bpm: bpm === "" ? null : Number(bpm),
          seed: seed === "" ? -1 : Number(seed),
          fast,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Could not queue the song.")
        return
      }
      setJob(data.job as Job)
      toast("Queued. Creating your song…")
    } catch {
      toast.error("Could not queue the song.")
    } finally {
      setSubmitting(false)
    }
  }

  const progress =
    typeof job?.progress === "number"
      ? job.progress
      : job?.status === "queued"
        ? 8
        : job?.status === "running"
          ? 40
          : 0

  const loadProgress =
    typeof health?.progress === "number" ? health.progress : engineLoading ? 35 : 0

  const engineNotice =
    engineLoading ||
    (!engineReady && !engineLoading && !generating && !engineBusy) ? (
      <>
        {engineLoading ? (
          <div className="flex flex-col gap-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <Spinner className="size-4 text-bee" />
              <p className="meta-caps text-foreground">Loading model</p>
            </div>
            <p className="text-xs text-text-muted">
              {health?.message || "Downloading or loading into memory…"}
            </p>
            <div className="h-px w-full overflow-hidden bg-foreground/10">
              <div
                className="h-full bg-bee transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        {!engineReady && !engineLoading && !generating && !engineBusy ? (
          <div className="flex gap-4 py-2 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-bee" />
            <div>
              <p className="meta-caps text-foreground">
                {health?.needsSetup ? "Setup needed" : "Engine offline"}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                {health?.needsSetup
                  ? "Open Engine to install models on this machine."
                  : health?.message ||
                    health?.error ||
                    "Open Engine to start, or run npm run studio."}
              </p>
              <button
                type="button"
                onClick={() => setView("engine")}
                className="mt-3 meta-caps text-bee hover:underline"
              >
                Open Engine →
              </button>
            </div>
          </div>
        ) : null}
      </>
    ) : null

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      health={health}
      generating={generating}
      onOpenEngine={() => setView("engine")}
      onOpenSettings={() => setSettingsOpen(true)}
      onStopEngine={() => void onStopEngine()}
    >
      {view === "create" ? (
        <CreateWorkspace
          style={style}
          onStyleChange={setStyle}
          lyrics={lyrics}
          onLyricsChange={setLyrics}
          voice={voice}
          onVoiceChange={onSelectVoice}
          voiceProfile={voiceProfile}
          voiceStrength={voiceStrength}
          onVoiceStrengthChange={setVoiceStrength}
          onImportVoice={() => setVoiceSetupOpen(true)}
          onClearVoice={() => void onClearVoice()}
          language={language}
          onLanguageChange={setLanguage}
          duration={duration}
          onDurationChange={setDuration}
          influence={influence}
          weirdness={weirdness}
          bpm={bpm}
          onInfluenceChange={setInfluence}
          onWeirdnessChange={setWeirdness}
          onBpmChange={setBpm}
          seed={seed}
          fast={fast}
          onSeedChange={setSeed}
          onFastChange={setFast}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onGenerate={onGenerate}
          busy={busy}
          generateDisabled={
            busy ||
            (!engineReady && !generating) ||
            engineLoading ||
            (voice === "custom" && !customReady)
          }
          generating={generating}
          job={job}
          progress={progress}
          current={current}
          engineNotice={engineNotice}
        />
      ) : null}

      {view === "library" ? (
        <LibraryView
          songs={songs}
          currentId={current?.id}
          onSelect={(song) => {
            setCurrent(song)
            setView("create")
          }}
          onCreate={() => setView("create")}
        />
      ) : null}

      {view === "voices" ? (
        <VoiceStudio
          profile={voiceProfile}
          voiceStrength={voiceStrength}
          onVoiceStrengthChange={setVoiceStrength}
          onImport={() => setVoiceSetupOpen(true)}
          onClear={() => void onClearVoice()}
        />
      ) : null}

      {view === "engine" ? (
        <EngineSettingsView
          health={health}
          onOpenWizard={() => setSetupWizardOpen(true)}
        />
      ) : null}

      <VoiceSetupDialog
        open={voiceSetupOpen}
        onOpenChange={setVoiceSetupOpen}
        onSaved={(profile) => {
          setVoiceProfile(profile)
          setVoice("custom")
        }}
      />
      <SetupWizard
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        onComplete={() => {
          setupPrompted.current = true
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        health={health}
        onOpenWizard={() => {
          setSettingsOpen(false)
          setSetupWizardOpen(true)
        }}
      />
    </AppShell>
  )
}
