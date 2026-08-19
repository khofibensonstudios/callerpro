import { dataUrlToResponse } from "@/lib/data-url";
import { withDb } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = await withDb((db) => db.users.find((u) => u.id === id)?.coverUrl);
  return dataUrlToResponse(url);
}
