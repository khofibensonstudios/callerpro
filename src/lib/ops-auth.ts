import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export const OPS_COOKIE = "cp_ops";

function opsSecret() {
  return (
    process.env.OPS_JWT_SECRET ||
    `${process.env.JWT_SECRET || "connect-pro-dev-secret-change-in-production"}:ops`
  );
}

export function signOpsToken() {
  return jwt.sign({ role: "ops", sub: "super" }, opsSecret(), { expiresIn: "8h" });
}

export function verifyOpsToken(token: string) {
  try {
    const payload = jwt.verify(token, opsSecret()) as { role?: string };
    return payload.role === "ops";
  } catch {
    return false;
  }
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  secure: (process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https://"),
};

export async function setOpsCookie(token: string) {
  const jar = await cookies();
  jar.set(OPS_COOKIE, token, { ...cookieOpts, maxAge: 60 * 60 * 8 });
}

export async function clearOpsCookie() {
  const jar = await cookies();
  jar.delete(OPS_COOKIE);
}

export async function opsSession() {
  const jar = await cookies();
  const token = jar.get(OPS_COOKIE)?.value;
  return token ? verifyOpsToken(token) : false;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a.normalize("NFKC"));
  const right = Buffer.from(b.normalize("NFKC"));
  const len = Math.max(left.length, right.length, 1);
  const aPad = Buffer.alloc(len);
  const bPad = Buffer.alloc(len);
  left.copy(aPad);
  right.copy(bPad);
  return timingSafeEqual(aPad, bPad) && left.length === right.length;
}

function opsPasswordHash() {
  let raw = (process.env.OPS_PASSWORD_HASH || "").trim();
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    raw = raw.slice(1, -1);
  }
  if (raw.startsWith("$2")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    if (decoded.startsWith("$2")) return decoded;
  } catch {
    /* ignore */
  }
  return raw;
}

export function opsCredentialsConfigured() {
  return Boolean((process.env.OPS_EMAIL || "").trim() && opsPasswordHash());
}

export function checkOpsCredentials(email: string, password: string) {
  const wantEmail = (process.env.OPS_EMAIL || "").trim();
  const hash = opsPasswordHash();
  if (!wantEmail || !hash) return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), wantEmail.toLowerCase());
  let passOk = false;
  try {
    passOk = bcrypt.compareSync(password, hash);
  } catch {
    passOk = false;
  }
  return emailOk && passOk;
}

type Attempt = { n: number; until: number };
const attempts = new Map<string, Attempt>();

export function opsClientKey(ip: string | null, ua: string | null) {
  return `${(ip || "local").split(",")[0]?.trim() || "local"}|${(ua || "").slice(0, 80)}`;
}

export function opsLocked(key: string) {
  const row = attempts.get(key);
  if (!row) return false;
  if (row.n >= 5 && Date.now() < row.until) return true;
  if (row.until && Date.now() >= row.until) {
    attempts.delete(key);
    return false;
  }
  return false;
}

export function opsFail(key: string) {
  const row = attempts.get(key) || { n: 0, until: 0 };
  row.n += 1;
  if (row.n >= 5) row.until = Date.now() + 15 * 60 * 1000;
  attempts.set(key, row);
}

export function opsClearFails(key: string) {
  attempts.delete(key);
}
