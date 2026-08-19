import { json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

function placesKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    ""
  ).trim();
}

export async function GET(req: Request) {
  const key = placesKey();
  if (!key) return json({ error: "Places is not configured." }, 503);
  const placeId = new URL(req.url).searchParams.get("placeId")?.trim() || "";
  if (!placeId) return json({ error: "Pick a place." }, 400);

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "formatted_address,name,geometry");
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      formatted_address?: string;
      name?: string;
      geometry?: { location?: { lat: number; lng: number } };
    };
  };
  if (data.status && data.status !== "OK") {
    return json({ error: data.error_message || data.status }, 400);
  }
  const result = data.result;
  if (!result?.geometry?.location) return json({ error: "Place not found." }, 404);
  return json({
    label: result.formatted_address || result.name || "",
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  });
}
