import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import {
  getLiveSession,
  getLiveSpotlight,
  listLiveGuests,
  requestLiveGuest,
  setLiveGuestStatus,
  setLiveSpotlight,
} from "@/lib/live";

export function OPTIONS() {
  return options();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return json({ error: "Live not found." }, 404);
  const guests = await listLiveGuests(id);
  return json({ guests, spotlightPeer: getLiveSpotlight(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session || session.status !== "live") return json({ error: "Live not found." }, 404);
  if (session.hostId === me) return json({ error: "Host cannot request guest." }, 400);
  const guest = await requestLiveGuest(id, me);
  return json({ guest });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Host updates who is big on stage.
  if ("spotlightPeer" in body && !body?.userId) {
    const peer = body.spotlightPeer === null || body.spotlightPeer === "" ? null : String(body.spotlightPeer);
    const ok = await setLiveSpotlight(id, me, peer);
    if (!ok) return json({ error: "Could not update layout." }, 400);
    const guests = await listLiveGuests(id);
    return json({ guests, spotlightPeer: getLiveSpotlight(id) });
  }

  const userId = typeof body?.userId === "string" ? body.userId : "";
  const status = body?.status === "accepted" || body?.status === "rejected" ? body.status : null;
  if (!userId || !status) return json({ error: "Invalid guest update." }, 400);
  const result = await setLiveGuestStatus(id, me, userId, status);
  if (!result.ok) {
    if (result.error === "stage_full") {
      return json(
        {
          error: "Stage is packed — drop someone to bring another guest on (12 max).",
          code: "stage_full",
        },
        400,
      );
    }
    return json({ error: "Could not update guest." }, 400);
  }
  if (status === "rejected") {
    const spot = getLiveSpotlight(id);
    if (spot === `guest:${userId}`) await setLiveSpotlight(id, me, null);
  }
  const guests = await listLiveGuests(id);
  return json({ guests, spotlightPeer: getLiveSpotlight(id) });
}
