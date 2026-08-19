import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { withDb, publicUser } from "./store";

const COOKIE = "cp_token";

function secret() {
  return process.env.JWT_SECRET || "connect-pro-dev-secret-change-in-production";
}

export function signToken(userId: string, extra?: { name?: string; callerId?: string }) {
  return jwt.sign({ sub: userId, name: extra?.name, callerId: extra?.callerId }, secret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, secret()) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export async function sessionClaims() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret()) as { sub: string; name?: string; callerId?: string };
    if (!payload?.sub) return null;
    return { id: payload.sub, name: payload.name, callerId: payload.callerId };
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function attachAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function sessionUserId() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export async function sessionUser() {
  const id = await sessionUserId();
  if (!id) return null;
  return withDb((db) => {
    const found = db.users.find((u) => u.id === id);
    return found
      ? {
          id: found.id,
          name: found.name,
          headline: found.headline,
          avatarHue: found.avatarHue,
          avatarUrl:
            found.avatarUrl && found.avatarUrl.startsWith("data:") && found.avatarUrl.length > 256
              ? `/api/users/${found.id}/photo`
              : found.avatarUrl,
          callerId: found.callerId,
          onboarded: found.onboarded,
        }
      : null;
  });
}

function tokenFromCookieHeader(header: string | null) {
  if (!header) return null;
  const part = header
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`));
  if (!part) return null;
  return decodeURIComponent(part.slice(COOKIE.length + 1));
}

export async function userIdFromRequest(req: Request) {
  const fromHeader = tokenFromCookieHeader(req.headers.get("cookie"));
  if (fromHeader) {
    const id = verifyToken(fromHeader);
    if (id) return id;
  }
  const jar = await cookies();
  const cookieToken = jar.get(COOKIE)?.value;
  if (cookieToken) {
    const id = verifyToken(cookieToken);
    if (id) return id;
  }
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return verifyToken(header.slice(7));
  }
  return null;
}

export async function requireUser(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return null;
  return withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    return user ? publicUser(user, true) : null;
  });
}
