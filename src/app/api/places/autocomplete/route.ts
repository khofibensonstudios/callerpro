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
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return json({ predictions: [] });

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    predictions?: { place_id: string; description: string }[];
  };
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return json({ error: data.error_message || data.status }, 400);
  }
  return json({
    predictions: (data.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      label: p.description,
    })),
  });
}
