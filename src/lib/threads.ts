import type { Thread } from "./types";

export function threadMemberIds(thread: Thread): string[] {
  const extra = (thread.memberIds ?? []).filter(Boolean);
  if (extra.length) return [...new Set(extra)];
  return [...new Set([thread.userA, thread.userB].filter(Boolean))];
}

export function isGroupThread(thread: Thread): boolean {
  return Boolean(thread.title) || threadMemberIds(thread).length > 2;
}
