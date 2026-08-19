import { json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST() {
  return json({ error: "Use a PIN to create an account." }, 410);
}
