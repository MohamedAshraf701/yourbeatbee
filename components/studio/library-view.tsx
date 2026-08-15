"use client"

import * as React from "react"
import { PlayIcon } from "lucide-react"

import {
  languageLabel,
  songTitle,
  voiceLabel,
} from "@/lib/format"
import type { Song } from "@/lib/types"
import { SongArtwork } from "@/components/studio/song-artwork"
import { SongDetail } from "@/components/studio/song-detail"
import { cn } from "@/lib/utils"

type Filter = "all" | "songs" | "instrumentals" | "drafts"

export function LibraryView({
  songs,
  currentId,
  onSelect,
  onCreate,
}: {
  songs: Song[]
  currentId?: string
  onSelect: (song: Song) => void
  onCreate: () => void
}) {
  const [filter, setFilter] = React.useState<Filter>("all")
  const [query, setQuery] = React.useState("")
  const [detail, setDetail] = React.useState<Song | null>(null)

  const filtered = songs.filter((song) => {
    if (filter === "instrumentals" && song.voice !== "instrumental") return false
    if (filter === "songs" && song.voice === "instrumental") return false
    if (filter === "drafts") return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      song.style.toLowerCase().includes(q) ||
      song.lyrics.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-12 pb-16 pt-4">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="meta-caps text-bee">Collection</p>
          <h1 className="display-hero mt-3 text-[clamp(2.75rem,7vw,5.5rem)]">
            Your
            <br />
            music.
          </h1>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="h-11 w-full max-w-xs border-0 border-b border-border bg-transparent text-sm outline-none placeholder:text-text-muted focus:border-bee/50"
        />
      </header>

      <div className="flex flex-wrap gap-5">
        {(
          [
            { id: "all", label: "All" },
            { id: "songs", label: "Songs" },
            { id: "instrumentals", label: "Instrumentals" },
            { id: "drafts", label: "Drafts", disabled: true },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={"disabled" in item && item.disabled}
            title={
              "disabled" in item && item.disabled ? "Unavailable" : undefined
            }
            data-active={filter === item.id}
            onClick={() => {
              if (!("disabled" in item && item.disabled)) setFilter(item.id)
            }}
            className={cn(
              "nav-underline meta-caps pb-0.5",
              filter === item.id ? "text-foreground" : "text-text-muted",
              "disabled" in item && item.disabled && "opacity-35"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {songs.length === 0 ? (
        <div className="border-y border-border py-20">
          <h2 className="display-section">Your next song is waiting.</h2>
          <p className="mt-4 max-w-md text-sm text-text-secondary">
            Create your first track and it will appear here.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-8 meta-caps text-bee hover:underline"
          >
            Create song →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((song) => (
            <article key={song.id} className="group flex flex-col gap-3">
              <div className="relative overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDetail(song)}
                  className="block w-full text-left"
                >
                  <SongArtwork
                    id={song.id}
                    style={song.style}
                    className={cn(
                      "w-full transition-transform duration-300 group-hover:scale-[1.03]",
                      song.id === currentId && "ring-1 ring-bee/40"
                    )}
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Play ${songTitle(song.style)}`}
                  onClick={() => onSelect(song)}
                  className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-bee text-primary-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
                >
                  <PlayIcon className="size-4 fill-current" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetail(song)}
                className="text-left"
              >
                <h3 className="truncate text-sm font-medium tracking-tight">
                  {songTitle(song.style)}
                </h3>
                <p className="meta-caps mt-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {voiceLabel(song.voice)} · {languageLabel(song.language)}
                </p>
              </button>
            </article>
          ))}
        </div>
      )}

      {detail ? (
        <SongDetail
          song={detail}
          onClose={() => setDetail(null)}
          onPlay={() => {
            onSelect(detail)
            setDetail(null)
          }}
        />
      ) : null}
    </div>
  )
}
