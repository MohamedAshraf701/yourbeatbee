import {
  maybeAutoStopEngine,
  touchPresence,
  presenceAgeMs,
  PRESENCE_IDLE_MS,
} from "@/lib/presence"

export const dynamic = "force-dynamic"

/** Studio UI pings this while open; closing the tab stops pings → auto-stop engine. */
export async function POST() {
  const presence = touchPresence()
  return Response.json({
    ok: true,
    presence,
    idleStopAfterMs: PRESENCE_IDLE_MS,
  })
}

export async function GET() {
  const auto = maybeAutoStopEngine()
  return Response.json({
    ageMs: presenceAgeMs(),
    idleStopAfterMs: PRESENCE_IDLE_MS,
    ...auto,
  })
}
