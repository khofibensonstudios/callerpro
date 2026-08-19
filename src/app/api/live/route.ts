import { json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return json({ lives: [], session: null });
}

export async function POST() {
  return json({ error: "Live broadcasts are off. Use video call in chat." }, 410);
}
