import { getJob } from "@/lib/jobs"
import { getSong } from "@/lib/songs"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const job = getJob(id)
  if (!job) {
    return Response.json({ error: "Job not found." }, { status: 404 })
  }
  const song = job.songId ? getSong(job.songId) : null
  return Response.json({ job, song })
}
