"use client"

import Image from "next/image"

import { BRAND } from "@/lib/brand"
import { getSongArt } from "@/lib/song-art"
import { cn } from "@/lib/utils"

export function SongArtwork({
  id,
  style = "",
  className,
  animated = false,
  /** Empty / idle cover — still shows brand mark in the center ring. */
  empty = false,
}: {
  id: string
  style?: string
  className?: string
  animated?: boolean
  empty?: boolean
}) {
  const art = getSongArt(id, style)
  const [h1, h2, h3] = art.hues
  const c1 = empty ? "var(--bee)" : `hsl(${h1} 48% 42%)`
  const c2 = empty ? "var(--art-deep)" : `hsl(${h2} 35% 18%)`
  const c3 = empty ? "#2a241c" : `hsl(${h3} 40% 28%)`

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden bg-[var(--art-deep)]",
        className
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(152deg, ${c2} 0%, var(--art-deep) 42%, ${c3} 100%)`,
          animation: animated ? "art-drift 9s ease-in-out infinite" : undefined,
        }}
      />

      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(circle at 30% 20%, color-mix(in srgb, ${c1} 40%, transparent), transparent 55%)`,
        }}
      />

      {/* Soft grid like vinyl / studio plate */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full opacity-50"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <g key={i}>
            <line
              x1={12 + i * 12}
              y1={10}
              x2={12 + i * 12}
              y2={90}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.35"
            />
            <line
              x1={10}
              y1={14 + i * 12}
              x2={90}
              y2={14 + i * 12}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.35"
            />
          </g>
        ))}
      </svg>

      {!empty && art.geometry === "bands" ? (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full opacity-50"
        >
          {art.bands.map((b, i) => (
            <rect
              key={i}
              x={0}
              y={8 + i * 6.2}
              width={100}
              height={2.2}
              fill={i % 3 === 0 ? c1 : "rgba(255,255,255,0.14)"}
              opacity={0.2 + b * 0.35}
            />
          ))}
        </svg>
      ) : null}

      {!empty && art.geometry === "arcs" ? (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M ${8 + i * 4} 78 Q 50 ${18 + i * 8} ${92 - i * 4} 78`}
              fill="none"
              stroke={i === 2 ? c1 : "rgba(255,255,255,0.2)"}
              strokeWidth={0.6 + i * 0.15}
              opacity={0.3 + i * 0.06}
            />
          ))}
        </svg>
      ) : null}

      {/* Center plate + YourBeatBee logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex size-[56%] items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--bee)_55%,transparent)]"
            style={{
              animation: animated
                ? "brand-idle 2.8s ease-in-out infinite"
                : undefined,
            }}
          />
          <span
            aria-hidden
            className="absolute inset-[18%] rounded-full bg-[color-mix(in_srgb,var(--bee)_22%,transparent)]"
          />
          <Image
            src={BRAND.mark.dark}
            alt=""
            width={160}
            height={160}
            className="relative z-10 size-[46%] object-contain drop-shadow-md"
            aria-hidden
          />
        </div>
      </div>

      {!empty ? (
        <div className="absolute inset-0 flex items-end p-5">
          <p
            className="font-medium tracking-[-0.06em] text-[clamp(2.5rem,8vw,4.5rem)] leading-none text-white/90"
            style={{ textShadow: "0 8px 40px rgba(0,0,0,0.45)" }}
          >
            {art.titleGlyphs.join("")}
          </p>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex h-12 items-end gap-px px-3 pb-3 opacity-80">
        {(empty ? Array.from({ length: 40 }, (_, i) => 0.25 + (i % 7) * 0.08) : art.bands.concat(art.bands).slice(0, 40)).map(
          (h, i) => (
            <span
              key={i}
              className="flex-1 rounded-[1px] bg-bee origin-bottom"
              style={{
                height: `${18 + h * 70}%`,
                opacity: 0.35 + h * 0.4,
                animation: animated
                  ? `soft-pulse ${0.55 + (i % 5) * 0.08}s ease-in-out infinite`
                  : undefined,
                animationDelay: animated ? `${(i % 8) * 40}ms` : undefined,
              }}
            />
          )
        )}
      </div>
    </div>
  )
}
