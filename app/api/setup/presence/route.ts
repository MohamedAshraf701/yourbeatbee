import {
  leavePresence,
  maybeAutoStopEngine,
  touchPresence,
  presenceAgeMs,
  PRESENCE_IDLE_MS,
} from "@/lib/presence"

export const dynamic = "force-dynamic"

/** Studio UI pings this while open; closing the tab stops pings → auto-stop engine. */
export async function POST(req: Request) {
  let leave = false
  try {
    const url = new URL(req.url)
    leave = url.searchParams.get("leave") === "1"
    if (!leave) {
      const body = (await req.json().catch(() => null)) as {
        leave?: boolean
      } | null
      leave = Boolean(body?.leave)
    }
  } catch {
    leave = false
  }

  if (leave) {
    const presence = leavePresence()
    const auto = maybeAutoStopEngine()
    return Response.json({
      ok: true,
      left: true,
      presence,
      idleStopAfterMs: PRESENCE_IDLE_MS,
      ...auto,
    })
  }

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
