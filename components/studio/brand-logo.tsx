"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import * as React from "react"

import { BRAND, BRAND_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

type Variant = "mark" | "wordmark"

export function BrandLogo({
  variant = "mark",
  className,
  priority = false,
  size = 28,
}: {
  variant?: Variant
  className?: string
  priority?: boolean
  /** Pixel height for mark; wordmark scales by height. */
  size?: number
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const mode = mounted && resolvedTheme === "light" ? "light" : "dark"
  const src = variant === "mark" ? BRAND.mark[mode] : BRAND.wordmark[mode]

  if (variant === "mark") {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        priority={priority}
        className={cn("size-auto rounded-sm object-contain", className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  const height = size
  const width = Math.round(size * (16 / 9))

  return (
    <Image
      src={src}
      alt={BRAND_NAME}
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto max-w-[200px] object-contain object-left", className)}
      style={{ height }}
    />
  )
}
