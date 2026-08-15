"use client"

import * as React from "react"
import {
  AudioLinesIcon,
  DownloadIcon,
  MicIcon,
  Music2Icon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { applyChip, STYLE_CHIPS } from "@/lib/chips"
import type {
  EngineHealth,
  Job,
  Language,
  Song,
  Voice,
  VoiceProfileInfo,
} from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Slider } from "@/components/ui/slider"
import { VoiceSetupDialog } from "@/components/voice-setup"
import { cn } from "@/lib/utils"

function sliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? Number(value[0] ?? 0) : Number(value)
}

function formatBytes(size: number | null) {
  if (!size) {
    return ""
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function Studio({ initialSongs = [] }: { initialSongs?: Song[] }) {
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
    if (!res.ok) {
      return
    }
    const data = (await res.json()) as { songs: Song[] }
    setSongs(data.songs)
    setCurrent((prev) => {
      if (selectId) {
        return data.songs.find((song) => song.id === selectId) ?? prev
      }
      return prev ?? data.songs[0] ?? null
    })
  }, [])

  const refreshVoice = React.useCallback(async () => {
    try {
      const res = await fetch("/api/voice")
      if (!res.ok) {
        return
      }
      setVoiceProfile((await res.json()) as VoiceProfileInfo)
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    void refreshVoice()
  }, [refreshVoice])

  React.useEffect(() => {
    let cancelled = false
    async function pollHealth() {
      try {
        const res = await fetch("/api/health")
        const data = (await res.json()) as EngineHealth
        if (!cancelled) {
          setHealth(data)
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
    if (!job || job.status === "done" || job.status === "error") {
      return
    }
    let cancelled = false
    async function pollJob() {
      const res = await fetch(`/api/jobs/${job!.id}`)
      if (!res.ok) {
        return
      }
      const data = (await res.json()) as { job: Job; song: Song | null }
      if (cancelled) {
        return
      }
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

  const engineReady = Boolean(health?.ready)
  const generating = Boolean(
    job && (job.status === "queued" || job.status === "running")
  )
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
    if (voice === "custom") {
      setVoice("female")
    }
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
      toast.error("Enter a style, lyrics, or both.")
      return
    }
    if (voice === "custom" && !customReady) {
      toast.error("Finish My Voice setup first.")
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
      toast("Queued. The local model is writing the song.")
    } catch {
      toast.error("Could not queue the song.")
    } finally {
      setSubmitting(false)
    }
  }

  const progress =
    job?.status === "queued" ? 22 : job?.status === "running" ? 68 : 0

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.02_250/0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.22_0.03_40/0.25),transparent_45%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:py-10">
        <header className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
              Local studio
            </p>
            <h1 className="font-heading text-4xl tracking-tight md:text-5xl">
              MusicAI
            </h1>
            <p className="max-w-lg text-sm text-muted-foreground">
              Style, lyrics, and your own voice — generated on this Mac with
              ACE-Step 1.5.
            </p>
          </div>
          <EngineBadge health={health} />
        </header>

        {!engineReady ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>
              {health?.message?.toLowerCase().includes("loading")
                ? "Loading model"
                : "Engine offline"}
            </AlertTitle>
            <AlertDescription>
              {health?.message ||
                health?.error ||
                "Start the local engine with npm run engine, then generate."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="flex flex-col gap-6">
            <form onSubmit={onGenerate} className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="style">Style</FieldLabel>
                  <Textarea
                    id="style"
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    placeholder="romantic Bollywood ballad, bansuri, tabla"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {STYLE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setStyle((value) => applyChip(value, chip))}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="lyrics">Lyrics</FieldLabel>
                  <Textarea
                    id="lyrics"
                    value={lyrics}
                    onChange={(event) => setLyrics(event.target.value)}
                    placeholder={"[Verse]\nTum paas ho...\n\n[Chorus]\n..."}
                    rows={7}
                  />
                  <FieldDescription>
                    Hindi or English. Leave blank and the local LM writes lyrics.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldTitle id="voice-label">Voice</FieldTitle>
                  <ToggleGroup
                    aria-labelledby="voice-label"
                    value={[voice]}
                    onValueChange={(value) => {
                      if (value[0]) {
                        onSelectVoice(value[0] as Voice)
                      }
                    }}
                    spacing={2}
                    className="flex-wrap"
                  >
                    <ToggleGroupItem value="female">Female</ToggleGroupItem>
                    <ToggleGroupItem value="male">Male</ToggleGroupItem>
                    <ToggleGroupItem value="custom">My Voice</ToggleGroupItem>
                    <ToggleGroupItem value="instrumental">
                      Instrumental
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                {voice === "custom" ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                    {customReady ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="secondary">Voice ready</Badge>
                          <span className="truncate text-muted-foreground">
                            {voiceProfile?.originalName || "My Voice"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(voiceProfile?.sizeBytes ?? null)}
                          </span>
                        </div>
                        <audio
                          className="w-full"
                          controls
                          src="/api/voice/audio"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setVoiceSetupOpen(true)}
                          >
                            <MicIcon data-icon="inline-start" />
                            Record again
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void onClearVoice()}
                          >
                            <Trash2Icon data-icon="inline-start" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                          Guided setup: sing the on-screen lines, then save.
                          This steers timbre toward your voice — not a perfect
                          Instant Voice Clone.
                        </p>
                        <Button
                          type="button"
                          onClick={() => setVoiceSetupOpen(true)}
                        >
                          <MicIcon data-icon="inline-start" />
                          Start voice setup
                        </Button>
                      </div>
                    )}

                    <Field>
                      <FieldLabel htmlFor="voice-strength">
                        Voice strength {voiceStrength}
                      </FieldLabel>
                      <Slider
                        id="voice-strength"
                        min={0}
                        max={100}
                        step={1}
                        value={voiceStrength}
                        onValueChange={(value) =>
                          setVoiceStrength(sliderValue(value))
                        }
                      />
                      <FieldDescription>
                        Higher sticks closer to your recorded tone. Restart the
                        engine after changing voice code, then regenerate.
                      </FieldDescription>
                    </Field>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldTitle id="language-label">Language</FieldTitle>
                    <ToggleGroup
                      aria-labelledby="language-label"
                      value={[language]}
                      onValueChange={(value) => {
                        if (value[0]) {
                          setLanguage(value[0] as Language)
                        }
                      }}
                      spacing={2}
                    >
                      <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
                      <ToggleGroupItem value="hi">Hindi</ToggleGroupItem>
                      <ToggleGroupItem value="en">English</ToggleGroupItem>
                    </ToggleGroup>
                  </Field>

                  <Field>
                    <FieldTitle id="duration-label">Duration</FieldTitle>
                    <ToggleGroup
                      aria-labelledby="duration-label"
                      value={[duration]}
                      onValueChange={(value) => {
                        if (value[0]) {
                          setDuration(value[0])
                        }
                      }}
                      spacing={2}
                      className="flex-wrap"
                    >
                      <ToggleGroupItem value="30">30s</ToggleGroupItem>
                      <ToggleGroupItem value="60">1m</ToggleGroupItem>
                      <ToggleGroupItem value="120">2m</ToggleGroupItem>
                      <ToggleGroupItem value="300">5m</ToggleGroupItem>
                      <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="influence">
                    Style influence {influence}
                  </FieldLabel>
                  <Slider
                    id="influence"
                    min={0}
                    max={100}
                    step={1}
                    value={influence}
                    onValueChange={(value) => setInfluence(sliderValue(value))}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="weirdness">
                    Weirdness {weirdness}
                  </FieldLabel>
                  <Slider
                    id="weirdness"
                    min={0}
                    max={100}
                    step={1}
                    value={weirdness}
                    onValueChange={(value) => setWeirdness(sliderValue(value))}
                  />
                </Field>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((value) => !value)}
                    className="text-xs tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
                  >
                    {showAdvanced ? "Hide advanced" : "Advanced"}
                  </button>
                  {showAdvanced ? (
                    <div className="mt-3 grid gap-4 sm:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="bpm">BPM</FieldLabel>
                        <Input
                          id="bpm"
                          inputMode="numeric"
                          value={bpm}
                          onChange={(event) => setBpm(event.target.value)}
                          placeholder="Auto"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="seed">Seed</FieldLabel>
                        <Input
                          id="seed"
                          inputMode="numeric"
                          value={seed}
                          onChange={(event) => setSeed(event.target.value)}
                          placeholder="Random"
                        />
                      </Field>
                      <Field>
                        <FieldTitle id="speed-label">Quality</FieldTitle>
                        <ToggleGroup
                          aria-labelledby="speed-label"
                          value={[fast ? "fast" : "quality"]}
                          onValueChange={(value) => {
                            if (value[0]) {
                              setFast(value[0] === "fast")
                            }
                          }}
                          spacing={2}
                        >
                          <ToggleGroupItem value="quality">
                            Quality
                          </ToggleGroupItem>
                          <ToggleGroupItem value="fast">Fast</ToggleGroupItem>
                        </ToggleGroup>
                      </Field>
                    </div>
                  ) : null}
                </div>
              </FieldGroup>

              {generating ? (
                <div className="flex flex-col gap-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground">
                    {job?.status === "queued"
                      ? "Waiting for the local engine…"
                      : "Generating vocals and instrumentation…"}
                  </p>
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                disabled={
                  busy ||
                  !engineReady ||
                  (voice === "custom" && !customReady)
                }
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {busy ? "Generating" : "Generate song"}
              </Button>
            </form>
          </section>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
            <Player song={current} />
            <Separator />
            <Library
              songs={songs}
              currentId={current?.id}
              onSelect={setCurrent}
            />
          </aside>
        </div>
      </div>

      <VoiceSetupDialog
        open={voiceSetupOpen}
        onOpenChange={setVoiceSetupOpen}
        onSaved={(profile) => {
          setVoiceProfile(profile)
          setVoice("custom")
        }}
      />
    </div>
  )
}

function EngineBadge({ health }: { health: EngineHealth | null }) {
  if (!health) {
    return (
      <Badge variant="secondary">
        <Spinner />
        Checking engine
      </Badge>
    )
  }
  if (health.ready) {
    return (
      <Badge variant="secondary">
        {health.device || "mps"} · {health.lm || health.model || "ACE-Step"}
      </Badge>
    )
  }
  return <Badge variant="outline">Engine offline</Badge>
}

function Player({ song }: { song: Song | null }) {
  if (!song) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg">Now playing</h2>
        <Empty className="border border-dashed border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Music2Icon />
            </EmptyMedia>
            <EmptyTitle>No song yet</EmptyTitle>
            <EmptyDescription>
              Generate from a style and lyrics to play here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg">Now playing</h2>
        <p className="line-clamp-2 text-sm font-medium">
          {song.style || "Untitled song"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {song.voice === "custom" ? "My Voice" : song.voice}
          </Badge>
          <Badge variant="outline">{song.language}</Badge>
        </div>
      </div>
      <audio
        key={song.id}
        className="w-full"
        controls
        src={`/api/songs/${song.id}/audio`}
      />
      {song.lyrics ? (
        <ScrollArea className="h-36 rounded-lg border border-border/60 p-3">
          <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {song.lyrics}
          </pre>
        </ScrollArea>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        render={<a href={`/api/songs/${song.id}/audio?download=1`} />}
        nativeButton={false}
      >
        <DownloadIcon data-icon="inline-start" />
        Download
      </Button>
    </div>
  )
}

function Library({
  songs,
  currentId,
  onSelect,
}: {
  songs: Song[]
  currentId?: string
  onSelect: (song: Song) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-lg">Library</h2>
        <p className="text-xs text-muted-foreground">Saved in data/songs</p>
      </div>
      {songs.length === 0 ? (
        <Empty className="border border-dashed border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AudioLinesIcon />
            </EmptyMedia>
            <EmptyTitle>Empty library</EmptyTitle>
            <EmptyDescription>Your songs will list here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="h-72">
          <div className="flex flex-col gap-1.5 pr-3">
            {songs.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => onSelect(song)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/70",
                  currentId === song.id && "bg-muted"
                )}
              >
                <span className="truncate font-medium">
                  {song.style || "Untitled song"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MicIcon className="size-3.5" />
                  {song.voice === "custom" ? "My Voice" : song.voice}
                  <span>{new Date(song.createdAt).toLocaleString()}</span>
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
