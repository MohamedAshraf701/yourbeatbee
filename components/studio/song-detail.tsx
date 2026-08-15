"use client"

import {
  DownloadIcon,
  PlayIcon,
  XIcon,
} from "lucide-react"

import {
  formatTime,
  languageLabel,
  songTitle,
  voiceLabel,
} from "@/lib/format"
import type { Song } from "@/lib/types"
import { SongArtwork } from "@/components/studio/song-artwork"

export function SongDetail({
  song,
  onClose,
  onPlay,
}: {
  song: Song
  onClose: () => void
  onPlay: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={songTitle(song.style)}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-8"
      onClick={onClose}
    >
      <div
        className="reveal-up max-h-[92vh] w-full max-w-4xl overflow-y-auto border border-border bg-background sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <SongArtwork id={song.id} style={song.style} className="w-full" />
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="meta-caps text-bee">Song</p>
                <h2 className="mt-3 text-3xl font-medium tracking-tight">
                  {songTitle(song.style)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {song.style || "Original track"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="text-text-muted hover:text-foreground"
              >
                <XIcon className="size-5" strokeWidth={1.5} />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="meta-caps">Voice</dt>
                <dd className="mt-1">{voiceLabel(song.voice)}</dd>
              </div>
              <div>
                <dt className="meta-caps">Language</dt>
                <dd className="mt-1">{languageLabel(song.language)}</dd>
              </div>
              <div>
                <dt className="meta-caps">Duration</dt>
                <dd className="mt-1">
                  {song.duration > 0 ? formatTime(song.duration) : "—"}
                </dd>
              </div>
              <div>
                <dt className="meta-caps">BPM</dt>
                <dd className="mt-1">{song.bpm != null ? String(song.bpm) : "Auto"}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-5">
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex items-center gap-2 bg-bee px-5 py-3 meta-caps text-primary-foreground"
              >
                <PlayIcon className="size-3.5 fill-current" />
                Play
              </button>
              <a
                href={`/api/songs/${song.id}/audio?download=1`}
                className="inline-flex items-center gap-2 meta-caps text-text-secondary hover:text-foreground"
              >
                <DownloadIcon className="size-3.5" strokeWidth={1.5} />
                Download
              </a>
              <span className="meta-caps text-text-muted opacity-40" title="Unavailable">
                Share
              </span>
              <span className="meta-caps text-text-muted opacity-40" title="Unavailable">
                Remix
              </span>
            </div>

            {song.lyrics ? (
              <div>
                <p className="meta-caps mb-3">Lyrics</p>
                <pre className="max-h-56 overflow-auto border-y border-border py-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">
                  {song.lyrics}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
