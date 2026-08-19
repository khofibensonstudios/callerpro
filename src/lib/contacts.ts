import type { DB, User } from "@/lib/types";
import { publicUser } from "@/lib/store";

export function contactName(db: DB, ownerId: string | null | undefined, userId: string) {
  if (!ownerId || ownerId === userId) return "";
  return (db.contacts ?? []).find((c) => c.ownerId === ownerId && c.userId === userId)?.name || "";
}

export function listContacts(db: DB, ownerId: string) {
  return (db.contacts ?? [])
    .filter((c) => c.ownerId === ownerId)
    .map((c) => {
      const user = db.users.find((u) => u.id === c.userId);
      if (!user) return null;
      return { ...publicUser(user), savedName: c.name };
    })
    .filter(Boolean) as Array<ReturnType<typeof publicUser> & { savedName: string }>;
}

export function upsertContact(db: DB, ownerId: string, user: User, name: string) {
  const next = name.trim().slice(0, 60);
  if (!next || ownerId === user.id) return null;
  db.contacts ??= [];
  const existing = db.contacts.find((c) => c.ownerId === ownerId && c.userId === user.id);
  if (existing) {
    existing.name = next;
    return existing;
  }
  const row = { ownerId, userId: user.id, name: next, createdAt: new Date().toISOString() };
  db.contacts.push(row);
  return row;
}
