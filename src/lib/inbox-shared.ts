import type { PublicUser } from "@/lib/types";

export type InboxItem = {
  id: string;
  kind: "chat" | "follow" | "like" | "comment" | "mention" | "comment_like";
  at: string;
  unread: boolean;
  preview: string;
  other: PublicUser;
  threadId?: string;
  activityId?: string;
  postId?: string;
  isGroup?: boolean;
  title?: string;
};

export function inboxHref(item: InboxItem) {
  if (item.kind === "chat" && item.threadId) return `/messages?t=${item.threadId}`;
  if (item.postId) return `/p/${item.postId}`;
  return `/u/${item.other.id}`;
}
