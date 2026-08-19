import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { leraReachable, warmupLeraModel } from "@/lib/lera-ollama";

export const maxDuration = 300;

export function OPTIONS() {
  return options();
}

/** Pre-load the Ollama model so the first user message is faster. */
export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return json({ error: "Sign in required." }, 401);

  if (!(await leraReachable())) {
    return json({ ok: false, error: "Ollama is not running." }, 503);
  }

  try {
    await warmupLeraModel();
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Warmup failed." }, 503);
  }
}
