import { createHash } from "crypto";
import bcrypt from "bcryptjs";

export function isPin(value: string) {
  return /^\d{4}$/.test(value);
}

export function isCallerId(value: string) {
  return /^\d{6}$/.test(value);
}

function pepper() {
  return process.env.JWT_SECRET || "connect-pro-dev-secret-change-in-production";
}

export function pinDigest(pin: string) {
  return createHash("sha256").update(`cp-pin:${pepper()}:${pin}`).digest("hex");
}

export function hashPin(pin: string) {
  return bcrypt.hashSync(pin, 10);
}

export function allocCallerId(taken: Set<string>) {
  for (let i = 0; i < 80; i++) {
    const id = String(100000 + Math.floor(Math.random() * 900000));
    if (!taken.has(id)) return id;
  }
  throw new Error("Could not allocate a caller ID.");
}
