import { createServiceClient } from "@/lib/supabase/service";
import { runAutomaticChasing } from "@/lib/chasing";

// Vercel Cron hits this on schedule (see vercel.json). Guarded by a shared
// secret so it can't be triggered by anyone who finds the URL.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const result = await runAutomaticChasing(supabase);
  return Response.json(result);
}
