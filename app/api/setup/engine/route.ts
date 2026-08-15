import {
  getEngineSupervisorStatus,
  restartEngineProcess,
  startEngineProcess,
  stopEngineProcess,
} from "@/lib/engine-supervisor"

export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(getEngineSupervisorStatus())
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const action =
    body && typeof body === "object"
      ? (body as { action?: string }).action
      : undefined

  if (action === "start") {
    return Response.json(startEngineProcess())
  }
  if (action === "stop" || action === "unload") {
    return Response.json(stopEngineProcess())
  }
  if (action === "restart") {
    return Response.json(restartEngineProcess())
  }
  return Response.json(
    { error: "action must be start, stop, unload, or restart" },
    { status: 400 }
  )
}
