import { json, options } from "@/lib/http";
import { clearAuthCookie } from "@/lib/auth";

export function OPTIONS() {
  return options();
}

export async function POST() {
  await clearAuthCookie();
  return json({ ok: true });
}
