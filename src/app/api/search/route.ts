import { json, options } from "@/lib/http";
import { publicUser, withDb } from "@/lib/store";
import { isCallerId } from "@/lib/pin";
import { userIdFromRequest } from "@/lib/auth";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  const raw = (new URL(req.url).searchParams.get("q") || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (!isCallerId(digits)) {
    return json({ people: [], posts: [], videos: [] });
  }

  const data = await withDb((db) => {
    const people = db.users
      .filter((u) => u.callerId === digits && u.id !== me)
      .map((u) => publicUser(u));
    return { people, posts: [], videos: [] };
  });
  return json(data);
}
