import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { DB, Post, PostKind, User } from "./types";
import { ensureSchema, usingPostgres, withClient } from "./db/pool";
import { loadAppDb, saveAppDb } from "./db/persist";
import { isReelPost } from "./seed-content";

const FILE = path.join(process.cwd(), "data", "store.json");
const MEDIA = path.join(process.cwd(), "data", "media");
const SCHEMA = 7;

let chain: Promise<unknown> = Promise.resolve();
let mem: DB | null = null;

function normalizeDb(raw: DB) {
  raw.saves ??= [];
  raw.comments ??= [];
  raw.deletedIds ??= [];
  raw.views ??= [];
  raw.ledger ??= [];
  raw.follows ??= [];
  raw.threads ??= [];
  raw.messages ??= [];
  raw.activities ??= [];
  raw.threadReads ??= [];
  raw.blocks ??= [];
  raw.contacts ??= [];
  for (const post of raw.posts) {
    post.likedBy ??= [];
    post.repostedBy ??= [];
  }
  for (const comment of raw.comments) {
    comment.likedBy ??= [];
  }
  for (const user of raw.users as Array<User & { password?: string }>) {
    if (!user.passwordHash && user.password) {
      user.passwordHash = bcrypt.hashSync(user.password, 8);
    }
    user.passwordHash ??= bcrypt.hashSync("demo1234", 8);
    user.skills ??= [];
    user.formats ??= [];
  }
  raw.posts = raw.posts.filter((p) => !raw.deletedIds?.includes(p.id));
  return raw;
}

function compactMedia(db: DB) {
  let dirty = false;
  for (const user of db.users) {
    const avatar = persistDataUrl(user.avatarUrl);
    const cover = persistDataUrl(user.coverUrl);
    if (avatar !== user.avatarUrl) {
      user.avatarUrl = avatar;
      dirty = true;
    }
    if (cover !== user.coverUrl) {
      user.coverUrl = cover;
      dirty = true;
    }
  }
  for (const post of db.posts) {
    const cover = persistDataUrl(post.coverImage);
    const video = persistDataUrl(post.videoUrl);
    if (cover !== post.coverImage) {
      post.coverImage = cover;
      dirty = true;
    }
    if (video !== post.videoUrl) {
      post.videoUrl = video;
      dirty = true;
    }
  }
  return dirty;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePgFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const snap = mem;
    if (!snap || !usingPostgres()) return;
    void withClient((client) => saveAppDb(client, snap)).catch(() => {});
  }, 250);
}

async function read(): Promise<{ db: DB; dirty: boolean }> {
  if (mem) return { db: mem, dirty: false };

  if (usingPostgres()) {
    await ensureSchema();
    let loaded = await withClient((client) => loadAppDb(client));
    if (!loaded) {
      mem = seed();
      compactMedia(mem);
      return { db: mem, dirty: true };
    }
    const dirty = compactMedia(loaded);
    mem = loaded;
    return { db: loaded, dirty };
  }

  if (!fs.existsSync(FILE)) {
    mem = seed();
    return { db: mem, dirty: true };
  }
  const raw = normalizeDb(JSON.parse(fs.readFileSync(FILE, "utf8")) as DB);
  let dirty = false;
  if (raw.schemaVersion !== SCHEMA) {
    raw.schemaVersion = SCHEMA;
    dirty = true;
  }
  dirty = ensureLiveStories(raw) || dirty;
  dirty = compactMedia(raw) || dirty;
  mem = raw;
  return { db: raw, dirty };
}

async function write(db: DB, immediate = false) {
  mem = db;
  if (usingPostgres()) {
    if (immediate) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await withClient((client) => saveAppDb(client, db));
      return;
    }
    schedulePgFlush();
    return;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  try {
    fs.writeFileSync(FILE, JSON.stringify(db));
  } catch {
    /* keep memory copy even if disk is busy */
  }
}

export async function reloadStore() {
  mem = null;
  await read();
}

export function withDb<T>(fn: (db: DB) => T | Promise<T>, persist = false): Promise<T> {
  const run = chain.then(async () => {
    const { db, dirty } = await read();
    const result = await fn(db);
    if (persist || dirty) await write(db, persist);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function persistDataUrl(value: string | undefined) {
  if (!value?.startsWith("data:")) return value;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return undefined;
  const mime = match[1];
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webm")
      ? "webm"
      : mime.includes("mp4") || mime.includes("quicktime")
        ? "mp4"
        : "jpg";
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.mkdirSync(MEDIA, { recursive: true });
  fs.writeFileSync(path.join(MEDIA, name), Buffer.from(match[2], "base64"));
  return `/api/media/${name}`;
}

function emptyDb(): DB {
  return {
    schemaVersion: SCHEMA,
    users: [],
    posts: [],
    views: [],
    ledger: [],
    follows: [],
    threads: [],
    messages: [],
    comments: [],
    saves: [],
    deletedIds: [],
    activities: [],
    threadReads: [],
    blocks: [],
    contacts: [],
  };
}

function ensureLiveStories(_db: DB) {
  return false;
}

function seed(): DB {
  return emptyDb();
}

function mediaSrc(value: string | undefined, proxy: string) {
  if (!value) return undefined;
  if (value.startsWith("data:") && value.length > 256) return proxy;
  return value;
}

export function toClientPost(post: Post, fullBody = false, commentCount = 0): Post {
  const body =
    fullBody || post.body.length <= 400
      ? post.body
      : post.kind === "blog"
        ? post.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280)
        : post.body.slice(0, 400);
  return {
    ...post,
    body,
    coverImage: mediaSrc(post.coverImage, `/api/posts/${post.id}/cover`),
    videoUrl: clientVideoUrl(post.videoUrl, post.id),
    commentCount,
  };
}

function clientVideoUrl(value: string | undefined, id: string) {
  if (!value || value.startsWith("blob:")) return undefined;
  if (value.includes("ForBiggerJoyrides") || value.includes("gtv-videos-bucket/sample/ForBiggerJoyrides")) return "/videos/a.mp4";
  if (value.includes("ForBiggerEscapes")) return "/videos/b.mp4";
  if (value.includes("ForBiggerFun")) return "/videos/c.mp4";
  if (value.includes("gtv-videos-bucket")) return "/videos/a.mp4";
  if (value.startsWith("data:") && value.length > 256) return `/api/posts/${id}/video`;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value)) {
    try {
      const u = new URL(value);
      return `${u.pathname}${u.search}`;
    } catch {
      return value;
    }
  }
  return value;
}

export function publicUser(user: User, includeEmail = false) {
  return {
    id: user.id,
    name: user.name,
    headline: user.headline,
    bio: user.bio,
    skills: user.skills,
    formats: user.formats ?? [],
    avatarHue: user.avatarHue,
    avatarUrl: mediaSrc(user.avatarUrl, `/api/users/${user.id}/photo`),
    coverUrl: mediaSrc(user.coverUrl, `/api/users/${user.id}/cover`),
    balanceMicros: user.balanceMicros,
    lifetimeMicros: user.lifetimeMicros,
    callerId: user.callerId,
    onboarded: user.onboarded,
    createdAt: user.createdAt,
    ...(includeEmail ? { email: user.email } : {}),
  };
}

function commentCountMap(db: DB) {
  const map = new Map<string, number>();
  for (const c of db.comments ?? []) map.set(c.postId, (map.get(c.postId) ?? 0) + 1);
  return map;
}

export function feedFrom(db: DB, viewerId?: string | null) {
  const authors = Object.fromEntries(db.users.map((u) => [u.id, publicUser(u)]));
  const counts = commentCountMap(db);
  return [...db.posts]
    .filter((post) => {
      if (!authors[post.authorId]) return false;
      const author = db.users.find((u) => u.id === post.authorId);
      if (author?.accountStatus && author.accountStatus !== "active") return false;
      if (post.published === false) return false;
      if (post.hidden) return false;
      if (db.deletedIds?.includes(post.id)) return false;
      if (post.kind === "story" && Date.now() - +new Date(post.createdAt) >= 24 * 60 * 60 * 1000) return false;
      if (post.kind === "blog") return false;
      if (post.visibility === "followers") {
        if (!viewerId) return false;
        if (post.authorId === viewerId) return true;
        return db.follows.some((f) => f.followerId === viewerId && f.followingId === post.authorId);
      }
      return true;
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((post) => ({ post: toClientPost(post, false, counts.get(post.id) ?? 0), author: authors[post.authorId] }));
}

export function getPostBundle(id: string) {
  return withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    const author = db.users.find((u) => u.id === post.authorId);
    if (!author) return null;
    const related = feedFrom(db).filter((row) => row.post.id !== id);
    const counts = commentCountMap(db);
    return { post: toClientPost(post, true, counts.get(post.id) ?? 0), author: publicUser(author), related };
  });
}

export function buildReel(
  db: DB,
  startId: string,
  opts: { src?: string; authorId?: string; taste?: string } = {},
) {
  const rows = feedFrom(db).filter((i) => isReelPost(i.post));
  const start = rows.find((i) => i.post.id === startId);
  if (!start) return [];
  const restPool = rows.filter((i) => i.post.id !== startId);
  const locked = opts.src === "profile" || Boolean(opts.authorId);
  if (locked) {
    const aid = opts.authorId || start.post.authorId;
    return [start, ...restPool.filter((i) => i.post.authorId === aid)];
  }
  const skill = start.post.skill || opts.taste || "";
  const same = restPool.filter((i) => i.post.skill === skill);
  const rest = restPool.filter((i) => i.post.skill !== skill);
  return [start, ...same, ...rest];
}
