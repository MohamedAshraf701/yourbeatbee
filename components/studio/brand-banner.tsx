"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import * as React from "react"

import { BRAND, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand"
import { cn } from "@/lib/utils"

export function BrandBanner({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const mode = mounted && resolvedTheme === "light" ? "light" : "dark"
  const src = BRAND.banner[mode]

  return (
    <figure
      className={cn(
        "relative overflow-hidden border border-border/60",
        className
      )}
    >
      <Image
        src={src}
        alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
        width={1920}
        height={1080}
        priority={priority}
        className="aspect-video h-auto w-full object-cover"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <figcaption className="sr-only">
        {BRAND_NAME}: {BRAND_TAGLINE}
      </figcaption>
    </figure>
  )
}
