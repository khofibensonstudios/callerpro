import fs from "fs";
import path from "path";
import { Pool, type PoolClient } from "pg";
import { SCHEMA_SQL } from "./schema";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;
let readyVer = 0;
const SCHEMA_VER = 23;
let cachedUrl: string | null = null;

/** Read DATABASE_URL at runtime (file fallback). Next must not bake an empty value at build. */
export function databaseUrl() {
  if (cachedUrl !== null) return cachedUrl;

  const env = process.env as Record<string, string | undefined>;
  let url = (env["DATABASE_URL"] || "").trim();

  if (!url) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const m = trimmed.match(/^DATABASE_URL\s*=\s*(.*)$/);
        if (!m) continue;
        url = m[1].trim().replace(/^['"]|['"]$/g, "");
        break;
      }
    } catch {
      /* ignore */
    }
  }

  cachedUrl = url;
  return cachedUrl;
}

export function usingPostgres() {
  return Boolean(databaseUrl());
}

export function getPool() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 8,
      idleTimeoutMillis: 20_000,
    });
  }
  return pool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  if (!usingPostgres()) return;
  if (readyVer !== SCHEMA_VER || !ready) {
    readyVer = SCHEMA_VER;
    ready = (async () => {
      const client = await getPool().connect();
      try {
        for (const stmt of SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
          try {
            await client.query(stmt);
          } catch (err) {
            const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
            // Idempotent schema: constraint/column/table already there from a previous boot.
            if (code === "42710" || code === "42701" || code === "42P07") continue;
            throw err;
          }
        }
      } finally {
        client.release();
      }
    })();
  }
  await ready;
}
