import { json, serverError } from "@/lib/server/http";
import { getProjectRow, toProjectPublic } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ project: toProjectPublic(await getProjectRow()) });
  } catch (error) {
    return serverError(error);
  }
}
