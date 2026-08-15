import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { BRAND, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand"
import { cn } from "@/lib/utils"

const siteDescription = `${BRAND_TAGLINE} — turn an idea, lyric, or mood into an original song on this device.`

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: siteDescription,
  applicationName: BRAND_NAME,
  keywords: [
    "YourBeatBee",
    "AI music",
    "local music studio",
    "ACE-Step",
    "text to music",
  ],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  icons: {
    icon: [
      { url: BRAND.favicon, type: "image/png", sizes: "512x512" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: BRAND.favicon,
  },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: siteDescription,
    images: [
      {
        url: BRAND.banner.dark,
        width: 1920,
        height: 1080,
        alt: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      },
      {
        url: BRAND.banner.light,
        width: 1920,
        height: 1080,
        alt: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description: siteDescription,
    images: [BRAND.banner.dark],
  },
  other: {
    "og:image:type": "image/png",
  },
}

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider defaultTheme="dark" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
