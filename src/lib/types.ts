export type PostKind = "video" | "clip" | "blog" | "note" | "story";

export type AccountStatus = "active" | "suspended" | "banned";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  pinDigest?: string;
  callerId?: string;
  name: string;
  headline: string;
  bio: string;
  skills: string[];
  formats: PostKind[];
  avatarHue: number;
  avatarUrl?: string;
  coverUrl?: string;
  balanceMicros: number;
  lifetimeMicros: number;
  onboarded: boolean;
  createdAt: string;
  accountStatus?: AccountStatus;
  statusReason?: string;
  settings?: import("./settings").UserSettings;
};

export type Block = {
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

export type Contact = {
  ownerId: string;
  userId: string;
  name: string;
  createdAt: string;
};

export type PublicUser = Omit<User, "passwordHash" | "email"> & {
  email?: string;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  likedBy?: string[];
};

export type Post = {
  id: string;
  authorId: string;
  kind: PostKind;
  title: string;
  body: string;
  skill: string;
  videoUrl?: string;
  coverImage?: string;
  tags?: string[];
  hashtags?: string[];
  visibility?: "everyone" | "followers";
  published?: boolean;
  hidden?: boolean;
  hiddenReason?: string;
  viewCount: number;
  earnMicros: number;
  likedBy: string[];
  repostedBy?: string[];
  commentCount?: number;
  createdAt: string;
};

export type Save = {
  userId: string;
  postId: string;
  createdAt: string;
};

export type ViewEvent = {
  id: string;
  postId: string;
  viewerId: string;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  postId: string | null;
  source: "view" | "ad" | "adjust" | "payout";
  micros: number;
  createdAt: string;
};

export type Follow = {
  followerId: string;
  followingId: string;
  createdAt?: string;
};

export type Thread = {
  id: string;
  userA: string;
  userB: string;
  updatedAt: string;
  title?: string;
  memberIds?: string[];
};

export type Message = {
  id: string;
  threadId: string;
  fromId: string;
  body: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  userId: string;
  actorId: string;
  kind: "follow" | "like" | "comment" | "mention" | "comment_like";
  refId?: string;
  createdAt: string;
  readAt?: string;
};

export type ThreadRead = {
  userId: string;
  threadId: string;
  lastReadAt: string;
};

export type DB = {
  schemaVersion: number;
  users: User[];
  posts: Post[];
  views: ViewEvent[];
  ledger: LedgerEntry[];
  follows: Follow[];
  threads: Thread[];
  messages: Message[];
  comments: Comment[];
  saves: Save[];
  deletedIds?: string[];
  activities?: Activity[];
  threadReads?: ThreadRead[];
  blocks?: Block[];
  contacts?: Contact[];
};
