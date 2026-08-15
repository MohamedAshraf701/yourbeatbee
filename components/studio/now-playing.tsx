"use client"

import * as React from "react"
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
} from "lucide-react"

import {
  formatTime,
  languageLabel,
  songTitle,
  voiceLabel,
} from "@/lib/format"
import type { Song } from "@/lib/types"
import { SongArtwork } from "@/components/studio/song-artwork"
import { Waveform } from "@/components/studio/waveform"
import { cn } from "@/lib/utils"

export function NowPlaying({
  song,
  className,
  compact = false,
}: {
  song: Song | null
  className?: string
  compact?: boolean
}) {
  if (!song) {
    return (
      <aside className={cn("flex flex-col gap-6", className)}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="meta-caps">Now Playing</p>
          <p className="meta-caps text-text-muted">Idle</p>
        </div>
        <SongArtwork id="idle" style="" empty className="w-full" />
        <p className="text-sm text-text-muted">
          Silence, for now. Create something you can hear.
        </p>
      </aside>
    )
  }

  return (
    <NowPlayingActive
      key={song.id}
      song={song}
      className={className}
      compact={compact}
    />
  )
}

function NowPlayingActive({
  song,
  className,
  compact,
}: {
  song: Song
  className?: string
  compact?: boolean
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  function seek(ratio: number) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = ratio * duration
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <aside className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="meta-caps">Now Playing</p>
        <p className="meta-caps text-bee">{playing ? "Live" : "Ready"}</p>
      </div>

      <SongArtwork
        id={song.id}
        style={song.style}
        animated={playing}
        className={cn("w-full", compact && "max-w-sm")}
      />

      <div>
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          {songTitle(song.style)}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
          {song.style || "Original track"}
        </p>
        <p className="meta-caps mt-3">
          {voiceLabel(song.voice)} · {languageLabel(song.language)}
        </p>
      </div>

      <audio
        ref={audioRef}
        src={`/api/songs/${song.id}/audio`}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        className="sr-only"
      />

      <Waveform progress={progress} playing={playing} onSeek={seek} />

      <div className="flex justify-between text-xs tabular-nums text-text-muted">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration || song.duration || 0)}</span>
      </div>

      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          aria-label="Restart"
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = 0
          }}
          className="text-text-muted transition-colors hover:text-foreground"
        >
          <SkipBackIcon className="size-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
          className="flex size-14 items-center justify-center rounded-full bg-bee text-primary-foreground transition-transform duration-150 hover:scale-[1.04]"
        >
          {playing ? (
            <PauseIcon className="size-5 fill-current" />
          ) : (
            <PlayIcon className="size-5 fill-current" />
          )}
        </button>
        <a
          href={`/api/songs/${song.id}/audio?download=1`}
          aria-label="Download"
          className="text-text-muted transition-colors hover:text-foreground"
        >
          <DownloadIcon className="size-4" strokeWidth={1.5} />
        </a>
      </div>

      <div className="flex flex-wrap gap-5 border-t border-border pt-4">
        <a
          href={`/api/songs/${song.id}/audio?download=1`}
          className="meta-caps text-text-secondary hover:text-foreground"
        >
          Download
        </a>
        <span className="meta-caps text-text-muted opacity-40" title="Unavailable">
          Share
        </span>
        <span className="meta-caps text-text-muted opacity-40" title="Unavailable">
          Remix
        </span>
        <span className="meta-caps text-text-muted opacity-40" title="Unavailable">
          Extend
        </span>
      </div>
    </aside>
  )
}
