import { readSetupStatus } from "@/lib/setup-install"

export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(readSetupStatus())
}
