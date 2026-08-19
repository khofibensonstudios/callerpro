import { dataUrlToResponse } from "@/lib/data-url";
import { withDb } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = await withDb((db) => db.posts.find((p) => p.id === id)?.coverImage);
  return dataUrlToResponse(url);
}
