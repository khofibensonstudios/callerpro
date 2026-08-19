import { cookies } from "next/headers";
import { PAYOUT_THRESHOLD_USD } from "@/lib/constants";
import { ensureSchema, usingPostgres, withClient } from "@/lib/db/pool";
import { loadOpsMeta, saveOpsMeta } from "@/lib/ops-meta";

export const OPS_THEME_COOKIE = "cp_ops_theme";

export type OpsSettings = {
  theme: "light" | "dark";
  blockedWords: string;
  wordRobot: boolean;
  commentRobot: boolean;
  liveRobot: boolean;
  autoHold: boolean;
  payoutThresholdUsd: number;
  liveMinFollowers: number;
};

export function defaultOpsSettings(): OpsSettings {
  return {
    theme: "light",
    blockedWords: "",
    wordRobot: true,
    commentRobot: true,
    liveRobot: true,
    autoHold: false,
    payoutThresholdUsd: PAYOUT_THRESHOLD_USD,
    liveMinFollowers: 0,
  };
}

function parseSettings(raw: unknown): OpsSettings {
  const base = defaultOpsSettings();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<OpsSettings>;
  return {
    theme: s.theme === "dark" ? "dark" : "light",
    blockedWords: String(s.blockedWords || ""),
    wordRobot: s.wordRobot !== false,
    commentRobot: s.commentRobot !== false,
    liveRobot: s.liveRobot !== false,
    autoHold: Boolean(s.autoHold),
    payoutThresholdUsd: Number.isFinite(Number(s.payoutThresholdUsd)) ? Number(s.payoutThresholdUsd) : base.payoutThresholdUsd,
    liveMinFollowers: Math.max(0, Number(s.liveMinFollowers) || 0),
  };
}

export async function getOpsSettings(): Promise<OpsSettings> {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT value FROM ops_settings WHERE key = 'desk'`);
      if (!res.rows[0]) return defaultOpsSettings();
      try {
        return parseSettings(JSON.parse(String(res.rows[0].value)));
      } catch {
        return defaultOpsSettings();
      }
    });
  }
  const meta = await loadOpsMeta();
  return parseSettings(meta.settings);
}

export async function saveOpsSettings(next: OpsSettings) {
  const value = JSON.stringify(next);
  if (usingPostgres()) {
    await ensureSchema();
    await withClient((client) =>
      client.query(
        `INSERT INTO ops_settings (key, value) VALUES ('desk', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [value],
      ),
    );
  } else {
    const meta = await loadOpsMeta();
    meta.settings = next;
    saveOpsMeta();
  }
  const jar = await cookies();
  jar.set(OPS_THEME_COOKIE, next.theme, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: (process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https://"),
  });
}

export async function opsTheme(): Promise<"light" | "dark"> {
  const jar = await cookies();
  const cookie = jar.get(OPS_THEME_COOKIE)?.value;
  if (cookie === "dark" || cookie === "light") return cookie;
  return (await getOpsSettings()).theme;
}

export function blockedWordList(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 1);
}

export function textHitsWords(text: string, words: string[]) {
  if (!words.length) return [];
  const hay = text.toLowerCase();
  return words.filter((w) => hay.includes(w));
}
