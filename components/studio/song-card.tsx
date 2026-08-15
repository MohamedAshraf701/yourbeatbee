"use client"

import {
  languageLabel,
  songTitle,
  voiceLabel,
} from "@/lib/format"
import type { Song } from "@/lib/types"
import { SongArtwork } from "@/components/studio/song-artwork"
import { cn } from "@/lib/utils"
import { PlayIcon } from "lucide-react"

export function SongCard({
  song,
  selected,
  onSelect,
  onPlay,
  compact = false,
}: {
  song: Song
  selected?: boolean
  onSelect: () => void
  onPlay: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:bg-elevated",
          selected && "border-border bg-elevated"
        )}
      >
        <SongArtwork
          id={song.id}
          style={song.style}
          className="size-12 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{songTitle(song.style)}</p>
          <p className="truncate text-xs text-text-muted">
            {voiceLabel(song.voice)} · {languageLabel(song.language)}
          </p>
        </div>
        <span
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
          className="flex size-8 items-center justify-center rounded-full text-text-secondary hover:text-bee"
        >
          <PlayIcon className="size-3.5 fill-current" />
        </span>
      </button>
    )
  }

  return (
    <article
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-transparent p-2 transition-colors hover:border-border hover:bg-surface",
        selected && "border-border bg-surface"
      )}
    >
      <button type="button" onClick={onSelect} className="relative text-left">
        <SongArtwork
          id={song.id}
          style={song.style}
          className="w-full transition-transform duration-200 group-hover:scale-[1.01]"
        />
        <span
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
          className="absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full bg-bee text-primary-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          <PlayIcon className="size-4 fill-current" />
        </span>
      </button>
      <button type="button" onClick={onSelect} className="px-1 text-left">
        <h3 className="truncate text-sm font-medium">{songTitle(song.style)}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
          {song.style || "Original"}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          {voiceLabel(song.voice)} · {languageLabel(song.language)}
        </p>
      </button>
    </article>
  )
}
