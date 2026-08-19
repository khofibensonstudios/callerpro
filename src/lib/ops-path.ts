/** Edge-safe. Keep this file free of Node-only imports — middleware uses it. */

const DEFAULT_GATE = "/cp-nx-9f2k";

const BLOCKED = new Set([
  "/",
  "/login",
  "/register",
  "/ops",
  "/api",
  "/shop",
  "/watch",
  "/u",
  "/settings",
  "/messages",
  "/profile",
  "/create",
  "/earn",
]);

export function opsGatePath() {
  let raw = (process.env.OPS_GATE_PATH || DEFAULT_GATE).trim();
  if (!raw.startsWith("/")) raw = `/${raw}`;
  raw = raw.replace(/\/+$/, "") || DEFAULT_GATE;
  if (BLOCKED.has(raw) || raw.startsWith("/api") || raw.startsWith("/_next") || raw.startsWith("/ops")) {
    return DEFAULT_GATE;
  }
  return raw;
}

export function isOpsGatePath(path: string) {
  const gate = opsGatePath();
  return path === gate || path.startsWith(`${gate}/`);
}

export function opsInternalPath(path: string) {
  const gate = opsGatePath();
  if (path === gate) return "/ops";
  if (path.startsWith(`${gate}/`)) return `/ops/${path.slice(gate.length + 1)}`;
  return null;
}

export function opsHref(path = "") {
  const gate = opsGatePath();
  if (!path || path === "/") return gate;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${gate}${suffix}`;
}
