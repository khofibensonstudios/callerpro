import type { PoolClient } from "pg";
import type { Activity, Block, Comment, Contact, DB, Follow, LedgerEntry, Message, Post, PostKind, Save, Thread, ThreadRead, User, ViewEvent } from "@/lib/types";
import { mergeSettings } from "@/lib/settings";

function iso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function textArr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

export async function loadAppDb(client: PoolClient): Promise<DB | null> {
  const usersRes = await client.query("SELECT * FROM users");
  if (!usersRes.rowCount) {
    return {
      schemaVersion: 7,
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

  const [
    postsRes,
    likesRes,
    repostsRes,
    viewsRes,
    ledgerRes,
    followsRes,
    threadsRes,
    messagesRes,
    commentsRes,
    savesRes,
    deletedRes,
    activityRes,
    threadReadsRes,
    blocksRes,
  ] = await Promise.all([
    client.query("SELECT * FROM posts"),
    client.query("SELECT post_id, user_id FROM post_likes"),
    client.query("SELECT post_id, user_id FROM post_reposts"),
    client.query("SELECT * FROM post_views"),
    client.query("SELECT * FROM ledger_entries"),
    client.query("SELECT follower_id, following_id, created_at FROM follows"),
    client.query("SELECT * FROM threads"),
    client.query("SELECT * FROM messages"),
    client.query("SELECT * FROM comments"),
    client.query("SELECT user_id, post_id, created_at FROM saves"),
    client.query("SELECT id FROM deleted_posts"),
    client.query("SELECT * FROM activity").catch(() => ({ rows: [] as Record<string, unknown>[] })),
    client.query("SELECT * FROM thread_reads").catch(() => ({ rows: [] as Record<string, unknown>[] })),
    client.query("SELECT blocker_id, blocked_id, created_at FROM blocks").catch(() => ({ rows: [] as Record<string, unknown>[] })),
  ]);
  const contactsRes = await client.query("SELECT owner_id, user_id, name, created_at FROM contacts").catch(() => ({ rows: [] as Record<string, unknown>[] }));

  const likes = new Map<string, string[]>();
  for (const row of likesRes.rows) {
    const list = likes.get(row.post_id) ?? [];
    list.push(row.user_id);
    likes.set(row.post_id, list);
  }
  const reposts = new Map<string, string[]>();
  for (const row of repostsRes.rows) {
    const list = reposts.get(row.post_id) ?? [];
    list.push(row.user_id);
    reposts.set(row.post_id, list);
  }

  const users: User[] = usersRes.rows.map((row) => ({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    pinDigest: row.pin_digest || undefined,
    callerId: row.caller_id || undefined,
    name: row.name,
    headline: row.headline || "",
    bio: row.bio || "",
    skills: textArr(row.skills),
    formats: textArr(row.formats) as PostKind[],
    avatarHue: Number(row.avatar_hue) || 0,
    avatarUrl: row.avatar_url || undefined,
    coverUrl: row.cover_url || undefined,
    balanceMicros: Number(row.balance_micros) || 0,
    lifetimeMicros: Number(row.lifetime_micros) || 0,
    onboarded: Boolean(row.onboarded),
    createdAt: iso(row.created_at),
    accountStatus: row.account_status === "suspended" || row.account_status === "banned" ? row.account_status : "active",
    statusReason: row.status_reason ? String(row.status_reason) : "",
    settings: mergeSettings(row.settings),
  }));

  const posts: Post[] = postsRes.rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    kind: row.kind as PostKind,
    title: row.title,
    body: row.body || "",
    skill: row.skill || "",
    videoUrl: row.video_url || undefined,
    coverImage: row.cover_image || undefined,
    tags: textArr(row.tags),
    hashtags: textArr(row.hashtags),
    visibility: row.visibility === "followers" ? "followers" : "everyone",
    published: row.published !== false,
    hidden: Boolean(row.hidden),
    hiddenReason: row.hidden_reason ? String(row.hidden_reason) : "",
    viewCount: Number(row.view_count) || 0,
    earnMicros: Number(row.earn_micros) || 0,
    likedBy: likes.get(row.id) ?? [],
    repostedBy: reposts.get(row.id) ?? [],
    createdAt: iso(row.created_at),
  }));

  const views: ViewEvent[] = viewsRes.rows.map((row) => ({
    id: row.id,
    postId: row.post_id,
    viewerId: row.viewer_id,
    createdAt: iso(row.created_at),
  }));

  const ledger: LedgerEntry[] = ledgerRes.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    postId: row.post_id,
    source: row.source === "ad" ? "ad" : row.source === "adjust" ? "adjust" : row.source === "payout" ? "payout" : "view",
    micros: Number(row.micros) || 0,
    createdAt: iso(row.created_at),
  }));

  const follows: Follow[] = followsRes.rows.map((row) => ({
    followerId: row.follower_id,
    followingId: row.following_id,
    createdAt: row.created_at ? iso(row.created_at) : undefined,
  }));

  const activities: Activity[] = (activityRes.rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    actorId: String(row.actor_id),
    kind: (["follow", "like", "comment", "mention", "comment_like"].includes(String(row.kind))
      ? String(row.kind)
      : "follow") as Activity["kind"],
    refId: row.ref_id ? String(row.ref_id) : undefined,
    createdAt: iso(row.created_at as string | Date),
    readAt: row.read_at ? iso(row.read_at as string | Date) : undefined,
  }));

  const threadReads: ThreadRead[] = (threadReadsRes.rows as Array<Record<string, unknown>>).map((row) => ({
    userId: String(row.user_id),
    threadId: String(row.thread_id),
    lastReadAt: iso(row.last_read_at as string | Date),
  }));

  const blocks: Block[] = (blocksRes.rows as Array<Record<string, unknown>>).map((row) => ({
    blockerId: String(row.blocker_id),
    blockedId: String(row.blocked_id),
    createdAt: iso(row.created_at as string | Date),
  }));

  const contacts: Contact[] = (contactsRes.rows as Array<Record<string, unknown>>).map((row) => ({
    ownerId: String(row.owner_id),
    userId: String(row.user_id),
    name: String(row.name || ""),
    createdAt: iso(row.created_at as string | Date),
  }));

  const threads: Thread[] = threadsRes.rows.map((row) => ({
    id: row.id,
    userA: row.user_a,
    userB: row.user_b,
    updatedAt: iso(row.updated_at),
    title: row.title || undefined,
    memberIds: Array.isArray(row.member_ids) ? row.member_ids.map(String) : [],
  }));

  const messages: Message[] = messagesRes.rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    fromId: row.from_id,
    body: row.body,
    createdAt: iso(row.created_at),
  }));

  const comments: Comment[] = commentsRes.rows.map((row) => ({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: iso(row.created_at),
    likedBy: textArr(row.liked_by),
  }));

  const saves: Save[] = savesRes.rows.map((row) => ({
    userId: row.user_id,
    postId: row.post_id,
    createdAt: iso(row.created_at),
  }));

  return {
    schemaVersion: 7,
    users,
    posts,
    views,
    ledger,
    follows,
    threads,
    messages,
    comments,
    saves,
    deletedIds: deletedRes.rows.map((row) => row.id),
    activities,
    threadReads,
    blocks,
    contacts,
  };
}

async function insert(client: PoolClient, sql: string, params: unknown[]) {
  try {
    await client.query(sql, params);
  } catch {
    /* skip rows that violate a key or missing parent */
  }
}

export async function saveAppDb(client: PoolClient, db: DB) {
  const userIds = new Set(db.users.map((u) => u.id));
  const postIds = new Set(db.posts.filter((p) => userIds.has(p.authorId)).map((p) => p.id));
  const threadIds = new Set(db.threads.filter((t) => userIds.has(t.userA) && userIds.has(t.userB)).map((t) => t.id));

  await client.query("BEGIN");
  try {
    await client.query(`
      TRUNCATE TABLE
        contacts, thread_reads, activity, deleted_posts, saves, comments, messages, threads, follows, blocks,
        ledger_entries, post_views, post_reposts, post_likes, posts, users
      CASCADE
    `);

    for (const user of db.users) {
      await client.query(
        `INSERT INTO users (
          id, email, password_hash, name, headline, bio, skills, formats,
          avatar_hue, avatar_url, cover_url, balance_micros, lifetime_micros, onboarded, created_at, settings,
          account_status, status_reason, caller_id, pin_digest
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          user.id,
          user.email.toLowerCase(),
          user.passwordHash,
          user.name,
          user.headline || "",
          user.bio || "",
          user.skills ?? [],
          user.formats ?? [],
          user.avatarHue || 0,
          user.avatarUrl || null,
          user.coverUrl || null,
          user.balanceMicros || 0,
          user.lifetimeMicros || 0,
          user.onboarded !== false,
          user.createdAt,
          JSON.stringify(user.settings ?? {}),
          user.accountStatus === "suspended" || user.accountStatus === "banned" ? user.accountStatus : "active",
          user.statusReason || "",
          user.callerId || null,
          user.pinDigest || null,
        ],
      );
    }

    for (const post of db.posts) {
      if (!postIds.has(post.id)) continue;
      await client.query(
        `INSERT INTO posts (
          id, author_id, kind, title, body, skill, video_url, cover_image, tags, hashtags,
          visibility, published, hidden, hidden_reason, view_count, earn_micros, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          post.id,
          post.authorId,
          post.kind,
          post.title,
          post.body || "",
          post.skill || "",
          post.videoUrl || null,
          post.coverImage || null,
          post.tags ?? [],
          post.hashtags ?? [],
          post.visibility === "followers" ? "followers" : "everyone",
          post.published !== false,
          Boolean(post.hidden),
          post.hiddenReason || "",
          post.viewCount || 0,
          post.earnMicros || 0,
          post.createdAt,
        ],
      );
      for (const userId of post.likedBy ?? []) {
        if (!userIds.has(userId)) continue;
        await insert(client, "INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [
          post.id,
          userId,
        ]);
      }
      for (const userId of post.repostedBy ?? []) {
        if (!userIds.has(userId)) continue;
        await insert(client, "INSERT INTO post_reposts (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [
          post.id,
          userId,
        ]);
      }
    }

    for (const view of db.views ?? []) {
      if (!postIds.has(view.postId)) continue;
      await insert(
        client,
        "INSERT INTO post_views (id, post_id, viewer_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
        [view.id, view.postId, view.viewerId, view.createdAt],
      );
    }

    for (const row of db.ledger ?? []) {
      if (!userIds.has(row.userId)) continue;
      await insert(
        client,
        "INSERT INTO ledger_entries (id, user_id, post_id, source, micros, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [row.id, row.userId, postIds.has(row.postId || "") ? row.postId : null, row.source, row.micros, row.createdAt],
      );
    }

    for (const follow of db.follows ?? []) {
      if (!userIds.has(follow.followerId) || !userIds.has(follow.followingId) || follow.followerId === follow.followingId) {
        continue;
      }
      await insert(
        client,
        "INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [follow.followerId, follow.followingId, follow.createdAt || new Date().toISOString()],
      );
    }

    for (const thread of db.threads ?? []) {
      if (!threadIds.has(thread.id)) continue;
      await client.query(
        "INSERT INTO threads (id, user_a, user_b, updated_at, title, member_ids) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          thread.id,
          thread.userA,
          thread.userB,
          thread.updatedAt,
          thread.title || null,
          thread.memberIds ?? [],
        ],
      );
    }

    for (const message of db.messages ?? []) {
      if (!threadIds.has(message.threadId) || !userIds.has(message.fromId)) continue;
      await insert(
        client,
        "INSERT INTO messages (id, thread_id, from_id, body, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [message.id, message.threadId, message.fromId, message.body, message.createdAt],
      );
    }

    for (const act of db.activities ?? []) {
      if (!userIds.has(act.userId) || !userIds.has(act.actorId)) continue;
      await insert(
        client,
        `INSERT INTO activity (id, user_id, actor_id, kind, ref_id, created_at, read_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           read_at = EXCLUDED.read_at,
           created_at = EXCLUDED.created_at`,
        [act.id, act.userId, act.actorId, act.kind, act.refId || null, act.createdAt, act.readAt || null],
      );
    }

    for (const read of db.threadReads ?? []) {
      if (!userIds.has(read.userId) || !threadIds.has(read.threadId)) continue;
      await insert(
        client,
        `INSERT INTO thread_reads (user_id, thread_id, last_read_at) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
        [read.userId, read.threadId, read.lastReadAt],
      );
    }

    for (const comment of db.comments ?? []) {
      if (!postIds.has(comment.postId) || !userIds.has(comment.authorId)) continue;
      await insert(
        client,
        `INSERT INTO comments (id, post_id, author_id, body, created_at, liked_by) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET liked_by = EXCLUDED.liked_by`,
        [comment.id, comment.postId, comment.authorId, comment.body, comment.createdAt, comment.likedBy ?? []],
      );
    }

    for (const save of db.saves ?? []) {
      if (!userIds.has(save.userId) || !postIds.has(save.postId)) continue;
      await insert(client, "INSERT INTO saves (user_id, post_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [
        save.userId,
        save.postId,
        save.createdAt,
      ]);
    }

    for (const id of db.deletedIds ?? []) {
      await insert(client, "INSERT INTO deleted_posts (id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
    }

    for (const block of db.blocks ?? []) {
      if (!userIds.has(block.blockerId) || !userIds.has(block.blockedId)) continue;
      await insert(client, "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [
        block.blockerId,
        block.blockedId,
        block.createdAt,
      ]);
    }

    for (const contact of db.contacts ?? []) {
      if (!userIds.has(contact.ownerId) || !userIds.has(contact.userId) || contact.ownerId === contact.userId) continue;
      await insert(
        client,
        "INSERT INTO contacts (owner_id, user_id, name, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (owner_id, user_id) DO UPDATE SET name = EXCLUDED.name",
        [contact.ownerId, contact.userId, contact.name, contact.createdAt],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
