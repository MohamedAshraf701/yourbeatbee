"use client"

import { cn } from "@/lib/utils"

/** Abstract bee-wing × frequency mark — no cartoon bee. */
export function BrandMark({
  playing = false,
  className,
  size = 28,
}: {
  playing?: boolean
  className?: string
  size?: number
}) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" className="size-full overflow-visible">
        <ellipse
          cx="16"
          cy="16"
          rx="11"
          ry="11"
          fill="none"
          stroke="var(--bee)"
          strokeOpacity="0.35"
          strokeWidth="0.75"
          style={{
            animation: playing ? undefined : "brand-idle 2.8s ease-in-out infinite",
          }}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={8 + i * 3.5}
            y={10}
            width="1.5"
            height={12}
            rx="0.75"
            fill="var(--bee)"
            className="origin-center"
            style={{
              transformOrigin: `${8.75 + i * 3.5}px 16px`,
              opacity: 0.55 + i * 0.08,
              animation: playing
                ? `brand-osc ${0.45 + i * 0.08}s ease-in-out infinite`
                : `brand-osc ${1.6 + i * 0.15}s ease-in-out infinite`,
              animationDelay: `${i * 0.06}s`,
            }}
          />
        ))}
        <path
          d="M6 16 Q10 8 16 16 Q22 24 26 16"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
      </svg>
    </span>
  )
}
