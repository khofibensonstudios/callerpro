import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { feedFrom, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const viewerId = await userIdFromRequest(req);
  const feed = await withDb((db) => feedFrom(db, viewerId));
  return json({ feed });
}
