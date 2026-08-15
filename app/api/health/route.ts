import { readEngineHealth } from "@/lib/engine"

export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(readEngineHealth())
}
