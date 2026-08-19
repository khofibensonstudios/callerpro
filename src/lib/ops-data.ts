import { ensureSchema, usingPostgres, withClient } from "@/lib/db/pool";
import { formatUsd } from "@/lib/earnings";
import { forceEndLive, listLiveSessions, listRecentLives } from "@/lib/live";
import {
  deleteProduct,
  getShop,
  listAllOrders,
  listAllProducts,
  listSellerProducts,
  listShops,
  reviewShop,
  setProductPublished,
  shopCounts,
} from "@/lib/shop";
import { withDb } from "@/lib/store";
import type { AccountStatus, Post, PostKind, User } from "@/lib/types";
import { postPath } from "@/lib/seed-content";
import { mergeSettings } from "@/lib/settings";
import { defaultPortrait } from "@/lib/constants";
import { loadOpsMeta, saveOpsMeta } from "@/lib/ops-meta";
import { opsRangeLabel, opsRangeWindow, parseOpsRange, type OpsRangeId } from "@/lib/ops-range";
import { blockedWordList, getOpsSettings, textHitsWords } from "@/lib/ops-settings";
import type { OpsAudit, OpsReport, OpsWithdrawal } from "@/lib/ops-types";

export type { OpsAudit, OpsReport, OpsWithdrawal } from "@/lib/ops-types";
export { OPS_RANGES, parseOpsRange, type OpsRangeId } from "@/lib/ops-range";

function nowIso() {
  return new Date().toISOString();
}

function accountStatus(user: User): AccountStatus {
  return user.accountStatus === "suspended" || user.accountStatus === "banned" ? user.accountStatus : "active";
}

function publicOpsUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    headline: user.headline,
    bio: user.bio,
    skills: user.skills ?? [],
    formats: user.formats ?? [],
    avatarUrl: user.avatarUrl || defaultPortrait(user.id),
    coverUrl: user.coverUrl,
    avatarHue: user.avatarHue,
    onboarded: user.onboarded,
    createdAt: user.createdAt,
    accountStatus: accountStatus(user),
    statusReason: user.statusReason || "",
    balanceMicros: user.balanceMicros,
    lifetimeMicros: user.lifetimeMicros,
    balanceLabel: formatUsd(user.balanceMicros),
    lifetimeLabel: formatUsd(user.lifetimeMicros),
  };
}

async function writeAudit(action: string, targetType: string, targetId: string, detail = "") {
  const row: OpsAudit = {
    id: `aud_${crypto.randomUUID()}`,
    action,
    targetType,
    targetId,
    detail: detail.slice(0, 400),
    createdAt: nowIso(),
  };
  if (usingPostgres()) {
    await ensureSchema();
    await withClient((client) =>
      client.query(
        `INSERT INTO admin_audit (id, action, target_type, target_id, detail, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [row.id, row.action, row.targetType, row.targetId, row.detail, row.createdAt],
      ),
    );
    return;
  }
  const meta = await loadOpsMeta();
  meta.audit.unshift(row);
  meta.audit = meta.audit.slice(0, 500);
  saveOpsMeta();
}

export async function opsNavCounts() {
  const header = await opsHeaderState();
  return {
    pendingShops: header.pendingShops,
    liveNow: header.liveNow,
    openReports: header.openReports,
    robotFiltered: header.robotFiltered,
  };
}

function peopleScore(row: { views: number; likes: number; followers: number; posts: number; lifetimeMicros: number }) {
  return row.views + row.likes * 8 + row.followers * 40 + row.posts * 12 + row.lifetimeMicros / 1_000_000;
}

function postScore(post: Post) {
  return (post.viewCount || 0) + (post.likedBy?.length || 0) * 15 + (post.earnMicros || 0) / 10_000;
}

function buildSeries(
  grain: "hour" | "day" | "week" | "month",
  from: Date,
  to: Date,
  users: User[],
  posts: Post[],
  comments: { createdAt: string }[],
  views: { createdAt: string }[],
  ledger: { createdAt: string; micros: number }[],
) {
  const buckets: { start: Date; end: Date; label: string; key: string }[] = [];
  if (grain === "hour") {
    const cursor = new Date(from);
    cursor.setMinutes(0, 0, 0);
    while (cursor < to) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setHours(end.getHours() + 1);
      buckets.push({
        start,
        end,
        key: start.toISOString(),
        label: start.toLocaleTimeString("en-US", { hour: "numeric" }),
      });
      cursor.setHours(cursor.getHours() + 1);
    }
  } else if (grain === "month") {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    if (+from === 0) {
      const oldest = [
        ...users.map((u) => u.createdAt),
        ...posts.map((p) => p.createdAt),
      ].sort()[0];
      const origin = oldest ? new Date(oldest) : new Date();
      cursor.setTime(+new Date(origin.getFullYear(), origin.getMonth(), 1));
    }
    while (cursor < to) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setMonth(end.getMonth() + 1);
      buckets.push({
        start,
        end,
        key: `${start.getFullYear()}-${start.getMonth() + 1}`,
        label: start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const step = grain === "week" ? 7 : 1;
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    while (cursor < to) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + step);
      buckets.push({
        start,
        end,
        key: start.toISOString().slice(0, 10),
        label:
          grain === "week"
            ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
      cursor.setDate(cursor.getDate() + step);
    }
  }
  const inBucket = (iso: string, b: { start: Date; end: Date }) => {
    const t = +new Date(iso);
    return t >= +b.start && t < +b.end;
  };
  return buckets.map((b) => ({
    label: b.label,
    key: b.key,
    users: users.filter((u) => inBucket(u.createdAt, b)).length,
    posts: posts.filter((p) => inBucket(p.createdAt, b)).length,
    comments: comments.filter((c) => inBucket(c.createdAt, b)).length,
    views: views.filter((v) => inBucket(v.createdAt, b)).length,
    earn: ledger.filter((l) => inBucket(l.createdAt, b)).reduce((s, l) => s + l.micros, 0),
  }));
}

export async function opsOverview(rangeRaw?: string | null) {
  const range = parseOpsRange(rangeRaw);
  const window = opsRangeWindow(range);
  const [shops, live] = await Promise.all([shopCounts(), listLiveSessions()]);
  const inWin = (iso: string) => {
    const t = +new Date(iso);
    return t >= +window.from && t < +window.to;
  };

  const snap = await withDb((db) => {
    const users = db.users;
    const posts = db.posts.filter((p) => !db.deletedIds?.includes(p.id));
    const comments = db.comments ?? [];
    const days = buildSeries(window.grain, window.from, window.to, users, posts, comments, db.views, db.ledger);
    const performingPeople = users
      .map((u) => {
        const authored = posts.filter((p) => p.authorId === u.id);
        const views = authored.reduce((s, p) => s + (p.viewCount || 0), 0);
        const likes = authored.reduce((s, p) => s + (p.likedBy?.length || 0), 0);
        const followers = db.follows.filter((f) => f.followingId === u.id).length;
        const row = {
          ...publicOpsUser(u),
          posts: authored.length,
          views,
          likes,
          followers,
          score: peopleScore({
            views,
            likes,
            followers,
            posts: authored.length,
            lifetimeMicros: u.lifetimeMicros,
          }),
        };
        return row;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const performingPosts = [...posts]
      .sort((a, b) => postScore(b) - postScore(a))
      .slice(0, 8)
      .map((p) => {
        const author = users.find((u) => u.id === p.authorId);
        return {
          id: p.id,
          title: p.title || p.kind,
          kind: p.kind,
          hidden: Boolean(p.hidden),
          views: p.viewCount,
          likes: p.likedBy?.length || 0,
          earnLabel: formatUsd(p.earnMicros),
          coverImage: p.coverImage || "",
          createdAt: p.createdAt,
          authorName: author?.name || "Unknown",
          authorId: p.authorId,
          authorAvatar: author?.avatarUrl || defaultPortrait(p.authorId),
          href: postPath(p.id, p.kind),
        };
      });
    const periodEarn = db.ledger.filter((l) => inWin(l.createdAt)).reduce((s, l) => s + l.micros, 0);
    return {
      people: users.length,
      posts: posts.length,
      comments: comments.length,
      signups: users.filter((u) => inWin(u.createdAt)).length,
      postsInRange: posts.filter((p) => inWin(p.createdAt)).length,
      commentsInRange: comments.filter((c) => inWin(c.createdAt)).length,
      viewsInRange: db.views.filter((v) => inWin(v.createdAt)).length,
      earnLabel: formatUsd(periodEarn),
      days,
      performingPeople,
      performingPosts,
    };
  });

  return {
    ...snap,
    range,
    rangeLabel: opsRangeLabel(range),
    pendingShops: shops.pending,
    liveNow: live.length,
    live: live.slice(0, 8).map((s) => ({
      id: s.id,
      title: s.title,
      viewers: s.viewerCount,
      peak: s.peakViewers || s.viewerCount,
      hostName: s.host?.name || "Host",
      hostId: s.hostId,
      startedAt: s.startedAt,
    })),
  };
}

export async function opsUsers(q = "", status: AccountStatus | "all" = "all", sort: "performance" | "new" | "wallet" = "performance") {
  const query = q.trim().toLowerCase();
  return withDb((db) => {
    const comments = db.comments ?? [];
    return db.users
      .filter((u) => {
        const st = accountStatus(u);
        if (status !== "all" && st !== status) return false;
        if (!query) return true;
        return (
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.id.toLowerCase().includes(query) ||
          (u.headline || "").toLowerCase().includes(query)
        );
      })
      .map((u) => {
        const authored = db.posts.filter((p) => p.authorId === u.id);
        const lastPost = authored[0]
          ? authored.reduce((a, b) => (+new Date(a.createdAt) > +new Date(b.createdAt) ? a : b))
          : null;
        const lastComment = comments
          .filter((c) => c.authorId === u.id)
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
        const lastView = db.views
          .filter((v) => v.viewerId === u.id)
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
        const lastActive = [u.createdAt, lastPost?.createdAt, lastComment?.createdAt, lastView?.createdAt]
          .filter(Boolean)
          .sort((a, b) => +new Date(String(b)) - +new Date(String(a)))[0] as string;
        return {
          ...publicOpsUser(u),
          posts: authored.length,
          hiddenPosts: authored.filter((p) => p.hidden).length,
          videos: authored.filter((p) => p.kind === "video" || p.kind === "clip").length,
          comments: comments.filter((c) => c.authorId === u.id).length,
          views: authored.reduce((s, p) => s + (p.viewCount || 0), 0),
          likes: authored.reduce((s, p) => s + (p.likedBy?.length || 0), 0),
          followers: db.follows.filter((f) => f.followingId === u.id).length,
          following: db.follows.filter((f) => f.followerId === u.id).length,
          lastActive,
          score: peopleScore({
            views: authored.reduce((s, p) => s + (p.viewCount || 0), 0),
            likes: authored.reduce((s, p) => s + (p.likedBy?.length || 0), 0),
            followers: db.follows.filter((f) => f.followingId === u.id).length,
            posts: authored.length,
            lifetimeMicros: u.lifetimeMicros,
          }),
        };
      })
      .sort((a, b) => {
        if (sort === "new") return +new Date(b.createdAt) - +new Date(a.createdAt);
        if (sort === "wallet") return b.balanceMicros - a.balanceMicros;
        return b.score - a.score;
      });
  });
}

export async function opsPeoplePulse() {
  return withDb((db) => {
    const comments = db.comments ?? [];
    const active = db.users.filter((u) => accountStatus(u) === "active").length;
    const held = db.users.filter((u) => accountStatus(u) !== "active").length;
    const onboarded = db.users.filter((u) => u.onboarded).length;
    return {
      total: db.users.length,
      active,
      held,
      onboarded,
      comments: comments.length,
      follows: db.follows.length,
    };
  });
}

function miniPerson(user?: User | null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl || defaultPortrait(user.id),
    headline: user.headline || "",
    accountStatus: accountStatus(user),
  };
}

export async function opsUser(id: string) {
  const shop = await getShop(id);
  const products = shop ? await listSellerProducts(id) : [];
  const reports = (await listReports("all")).filter((r) => r.targetType === "user" && r.targetId === id);
  return withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) return null;
    const authored = db.posts
      .filter((p) => p.authorId === id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const posts = authored.map((p) => ({
      id: p.id,
      title: p.title || p.kind,
      kind: p.kind,
      hidden: Boolean(p.hidden),
      published: p.published !== false,
      views: p.viewCount,
      likes: p.likedBy?.length || 0,
      coverImage: p.coverImage || "",
      createdAt: p.createdAt,
      href: postPath(p.id, p.kind),
    }));
    const comments = (db.comments ?? [])
      .filter((c) => c.authorId === id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 40)
      .map((c) => {
        const post = db.posts.find((p) => p.id === c.postId);
        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          likes: c.likedBy?.length || 0,
          postId: c.postId,
          postTitle: post?.title || c.postId,
        };
      });
    const followerRows = db.follows.filter((f) => f.followingId === id);
    const followingRows = db.follows.filter((f) => f.followerId === id);
    const followers = followerRows.length;
    const following = followingRows.length;
    const followerPeople = followerRows
      .slice(0, 18)
      .map((f) => miniPerson(db.users.find((u) => u.id === f.followerId)))
      .filter(Boolean);
    const followingPeople = followingRows
      .slice(0, 18)
      .map((f) => miniPerson(db.users.find((u) => u.id === f.followingId)))
      .filter(Boolean);
    const blockedOut = (db.blocks ?? []).filter((b) => b.blockerId === id);
    const blockedIn = (db.blocks ?? []).filter((b) => b.blockedId === id);
    const ledger = db.ledger
      .filter((l) => l.userId === id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 30)
      .map((l) => ({
        id: l.id,
        source: l.source,
        amount: formatUsd(l.micros),
        createdAt: l.createdAt,
      }));
    const lastPost = authored[0]?.createdAt;
    const lastComment = comments[0]?.createdAt;
    const lastView = db.views
      .filter((v) => v.viewerId === id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]?.createdAt;
    const lastActive = [user.createdAt, lastPost, lastComment, lastView]
      .filter(Boolean)
      .sort((a, b) => +new Date(String(b)) - +new Date(String(a)))[0] as string;
    const settings = mergeSettings(user.settings);
    const threadCount = (db.threads ?? []).filter((t) => t.userA === id || t.userB === id).length;
    const viewsReceived = authored.reduce((s, p) => s + (p.viewCount || 0), 0);
    const likesReceived = authored.reduce((s, p) => s + (p.likedBy?.length || 0), 0);
    const viewsGiven = db.views.filter((v) => v.viewerId === id).length;
    return {
      user: publicOpsUser(user),
      bio: user.bio,
      posts,
      comments,
      followers,
      following,
      followerPeople,
      followingPeople,
      blockedOut: blockedOut.length,
      blockedIn: blockedIn.length,
      blocked: blockedOut.length + blockedIn.length,
      ledger,
      shop,
      products: products.slice(0, 16),
      reports,
      lastActive,
      settings: {
        privateAccount: settings.privateAccount,
        followWho: settings.followWho,
        verifyRequested: settings.verifyRequested,
        adsOnLive: settings.adsOnLive,
      },
      conversations: threadCount,
      viewsReceived,
      likesReceived,
      viewsGiven,
      hiddenCount: authored.filter((p) => p.hidden).length,
      kinds: {
        video: authored.filter((p) => p.kind === "video").length,
        clip: authored.filter((p) => p.kind === "clip").length,
        note: authored.filter((p) => p.kind === "note").length,
        blog: authored.filter((p) => p.kind === "blog").length,
        story: authored.filter((p) => p.kind === "story").length,
      },
    };
  });
}

export async function setUserStatus(id: string, status: AccountStatus, reason = "") {
  const ok = await withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) return false;
    user.accountStatus = status;
    user.statusReason = reason.trim().slice(0, 200);
    return true;
  }, true);
  if (ok) await writeAudit(`user.${status}`, "user", id, reason);
  return ok;
}

export async function adjustWallet(id: string, usd: number, note = "") {
  const micros = Math.round(usd * 1_000_000);
  if (!Number.isFinite(micros) || micros === 0) return false;
  const ok = await withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) return false;
    user.balanceMicros = Math.max(0, user.balanceMicros + micros);
    if (micros > 0) user.lifetimeMicros += micros;
    db.ledger.push({
      id: `led_${crypto.randomUUID()}`,
      userId: id,
      postId: null,
      source: micros < 0 ? "payout" : "adjust",
      micros,
      createdAt: nowIso(),
    });
    return true;
  }, true);
  if (ok) await writeAudit("wallet.adjust", "user", id, `${usd} ${note}`.trim());
  return ok;
}

function postRow(post: Post, author?: User, commentCount = 0) {
  return {
    id: post.id,
    title: post.title || "(no title)",
    kind: post.kind,
    skill: post.skill,
    hidden: Boolean(post.hidden),
    published: post.published !== false,
    views: post.viewCount,
    likes: post.likedBy?.length || 0,
    comments: commentCount,
    earnLabel: formatUsd(post.earnMicros),
    createdAt: post.createdAt,
    authorId: post.authorId,
    authorName: author?.name || "Unknown",
    authorAvatar: author?.avatarUrl || defaultPortrait(post.authorId),
    href: postPath(post.id, post.kind),
    coverImage: post.coverImage || "",
    bodyPreview: (post.body || "").replace(/\s+/g, " ").slice(0, 140),
  };
}

export async function opsPosts(
  q = "",
  kind: PostKind | "all" = "all",
  visibility: "all" | "live" | "hidden" = "all",
  sort: "performance" | "new" = "performance",
) {
  const query = q.trim().toLowerCase();
  return withDb((db) => {
    const authors = Object.fromEntries(db.users.map((u) => [u.id, u]));
    const commentCounts = new Map<string, number>();
    for (const c of db.comments ?? []) commentCounts.set(c.postId, (commentCounts.get(c.postId) || 0) + 1);
    return db.posts
      .filter((p) => {
        if (kind !== "all" && p.kind !== kind) return false;
        if (visibility === "hidden" && !p.hidden) return false;
        if (visibility === "live" && p.hidden) return false;
        if (!query) return true;
        const author = authors[p.authorId];
        return (
          p.title.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          (author?.name || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (sort === "new" ? +new Date(b.createdAt) - +new Date(a.createdAt) : postScore(b) - postScore(a)))
      .slice(0, 160)
      .map((p) => postRow(p, authors[p.authorId], commentCounts.get(p.id) || 0));
  });
}

export async function opsContentPulse() {
  return withDb((db) => {
    const posts = db.posts;
    return {
      total: posts.length,
      hidden: posts.filter((p) => p.hidden).length,
      video: posts.filter((p) => p.kind === "video").length,
      clip: posts.filter((p) => p.kind === "clip").length,
      note: posts.filter((p) => p.kind === "note").length,
      blog: posts.filter((p) => p.kind === "blog").length,
      story: posts.filter((p) => p.kind === "story").length,
      views: posts.reduce((s, p) => s + (p.viewCount || 0), 0),
    };
  });
}

export async function opsPost(id: string) {
  return withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    const author = db.users.find((u) => u.id === post.authorId);
    const comments = (db.comments ?? [])
      .filter((c) => c.postId === id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return {
      post: {
        ...postRow(post, author),
        body: post.body.slice(0, 2000),
        hiddenReason: post.hiddenReason || "",
        videoUrl: post.videoUrl,
      },
      author: author ? publicOpsUser(author) : null,
      comments: comments.map((c) => {
        const u = db.users.find((x) => x.id === c.authorId);
        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          likes: c.likedBy?.length || 0,
          authorName: u?.name || "Unknown",
          authorId: c.authorId,
          authorAvatar: u?.avatarUrl || defaultPortrait(c.authorId),
        };
      }),
    };
  });
}

export async function hidePost(id: string, hidden: boolean, reason = "") {
  const ok = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return false;
    post.hidden = hidden;
    post.hiddenReason = hidden ? reason.trim().slice(0, 200) : "";
    return true;
  }, true);
  if (ok) await writeAudit(hidden ? "post.hide" : "post.restore", "post", id, reason);
  return ok;
}

export async function deletePostAsOps(id: string) {
  const ok = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return false;
    db.posts = db.posts.filter((p) => p.id !== id);
    db.comments = (db.comments ?? []).filter((c) => c.postId !== id);
    db.saves = (db.saves ?? []).filter((s) => s.postId !== id);
    db.deletedIds = [...new Set([...(db.deletedIds ?? []), id])];
    return true;
  }, true);
  if (ok) await writeAudit("post.delete", "post", id);
  return ok;
}

export async function opsComments() {
  return withDb((db) => {
    const users = Object.fromEntries(db.users.map((u) => [u.id, u]));
    const posts = Object.fromEntries(db.posts.map((p) => [p.id, p]));
    const all = [...(db.comments ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      total: all.length,
      today: all.filter((c) => +new Date(c.createdAt) >= +todayStart).length,
      liked: all.filter((c) => (c.likedBy?.length || 0) > 0).length,
      rows: all.slice(0, 220).map((c) => {
        const author = users[c.authorId];
        const post = posts[c.postId];
        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          likes: c.likedBy?.length || 0,
          authorId: c.authorId,
          authorName: author?.name || "Unknown",
          authorAvatar: author?.avatarUrl || defaultPortrait(c.authorId),
          authorStatus: author ? accountStatus(author) : "active",
          postId: c.postId,
          postTitle: post?.title || c.postId,
          postKind: post?.kind || "note",
          postCover: post?.coverImage || "",
          postHidden: Boolean(post?.hidden),
        };
      }),
    };
  });
}

export async function deleteCommentAsOps(id: string) {
  const ok = await withDb((db) => {
    const before = db.comments?.length || 0;
    db.comments = (db.comments ?? []).filter((c) => c.id !== id);
    return (db.comments?.length || 0) < before;
  }, true);
  if (ok) await writeAudit("comment.delete", "comment", id);
  return ok;
}

export async function opsLives() {
  const [now, recent] = await Promise.all([listLiveSessions(), listRecentLives(120)]);
  const peak = recent.reduce((s, r) => Math.max(s, r.peakViewers || r.viewerCount || 0), 0);
  const watching = now.reduce((s, r) => s + (r.viewerCount || 0), 0);
  return {
    now,
    recent,
    watching,
    peak,
    ended: recent.filter((s) => s.status === "ended").length,
  };
}

export async function endLiveAsOps(id: string) {
  const summary = await forceEndLive(id);
  if (summary) await writeAudit("live.end", "live", id, summary.title);
  return Boolean(summary);
}

export async function opsCommerceDesk() {
  const [shops, products, orders, counts] = await Promise.all([
    listShops("all"),
    listAllProducts(),
    listAllOrders(),
    shopCounts(),
  ]);
  const gmv = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
  return {
    shops,
    products,
    orders,
    counts,
    gmv,
    liveProducts: products.filter((p) => p.published).length,
    draftProducts: products.filter((p) => !p.published).length,
  };
}

export async function opsShopRows(status: "pending" | "verified" | "rejected" | "all" | "setup" | "off" = "pending") {
  const shops = await listShops(status === "all" ? "all" : status);
  const products = await listAllProducts();
  return withDb((db) => {
    return shops.map((shop) => {
      const seller = db.users.find((u) => u.id === shop.userId);
      const catalog = products.filter((p) => p.sellerId === shop.userId);
      return {
        ...shop,
        sellerName: seller?.name || "Unknown",
        sellerEmail: seller?.email || "",
        sellerAvatar: seller?.avatarUrl || defaultPortrait(shop.userId),
        productCount: catalog.length,
        liveProducts: catalog.filter((p) => p.published).length,
      };
    });
  });
}

export async function setShopStatus(userId: string, status: "verified" | "rejected") {
  const shop = await reviewShop(userId, status);
  if (shop) await writeAudit(`shop.${status}`, "shop", userId, shop.name);
  return shop;
}

export async function opsSetProductPublished(id: string, published: boolean) {
  const product = await setProductPublished(id, published);
  if (product) await writeAudit(published ? "product.publish" : "product.unpublish", "product", id, product.name);
  return product;
}

export async function opsDeleteProduct(id: string) {
  const product = await listAllProducts().then((rows) => rows.find((p) => p.id === id) || null);
  if (!product) return false;
  const ok = await deleteProduct(id, product.sellerId);
  if (ok) await writeAudit("product.delete", "product", id, product.name);
  return ok;
}

export async function opsMessagePrivacy() {
  return withDb((db) => ({
    conversations: (db.threads ?? []).length,
    sealed: true,
  }));
}

export async function opsWallet() {
  return withDb((db) => {
    const held = db.users.reduce((s, u) => s + (u.balanceMicros || 0), 0);
    const lifetime = db.users.reduce((s, u) => s + (u.lifetimeMicros || 0), 0);
    const top = [...db.users]
      .sort((a, b) => b.balanceMicros - a.balanceMicros)
      .slice(0, 30)
      .map(publicOpsUser);
    const recent = [...db.ledger]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 40)
      .map((l) => {
        const u = db.users.find((x) => x.id === l.userId);
        return {
          id: l.id,
          userId: l.userId,
          name: u?.name || "Unknown",
          source: l.source,
          amount: formatUsd(l.micros),
          createdAt: l.createdAt,
        };
      });
    return {
      heldLabel: formatUsd(held),
      lifetimeLabel: formatUsd(lifetime),
      top,
      recent,
    };
  });
}

function rowReport(row: Record<string, unknown>): OpsReport {
  const source = String(row.source || "console");
  return {
    id: String(row.id),
    targetType: String(row.target_type) as OpsReport["targetType"],
    targetId: String(row.target_id),
    reporterId: row.reporter_id ? String(row.reporter_id) : undefined,
    source: source === "robot" || source === "user" ? source : "console",
    reason: String(row.reason || ""),
    status: (row.status as OpsReport["status"]) || "open",
    notes: String(row.notes || ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : undefined,
  };
}

export async function listReports(status?: OpsReport["status"] | "all") {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res =
        status && status !== "all"
          ? await client.query(`SELECT * FROM reports WHERE status = $1 ORDER BY created_at DESC LIMIT 200`, [status])
          : await client.query(`SELECT * FROM reports ORDER BY created_at DESC LIMIT 200`);
      return res.rows.map(rowReport);
    });
  }
  const meta = await loadOpsMeta();
  const rows = meta.reports.map((r) => ({ ...r, source: r.source || ("console" as const) }));
  return status && status !== "all" ? rows.filter((r) => r.status === status) : rows;
}

export async function createReport(input: {
  targetType: OpsReport["targetType"];
  targetId: string;
  reason: string;
  source?: OpsReport["source"];
  silent?: boolean;
}) {
  const row: OpsReport = {
    id: `rep_${crypto.randomUUID()}`,
    targetType: input.targetType,
    targetId: input.targetId,
    source: input.source || "console",
    reason: input.reason.trim().slice(0, 400) || "Flagged from console",
    status: "open",
    notes: "",
    createdAt: nowIso(),
  };
  if (usingPostgres()) {
    await ensureSchema();
    await withClient((client) =>
      client.query(
        `INSERT INTO reports (id, target_type, target_id, reason, status, notes, created_at, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [row.id, row.targetType, row.targetId, row.reason, row.status, row.notes, row.createdAt, row.source],
      ),
    );
  } else {
    const meta = await loadOpsMeta();
    meta.reports.unshift(row);
    saveOpsMeta();
  }
  if (!input.silent) await writeAudit("report.create", row.targetType, row.targetId, row.reason);
  return row;
}

export async function resolveReport(id: string, status: "resolved" | "dismissed" | "reviewing", notes = "") {
  if (usingPostgres()) {
    await ensureSchema();
    const row = await withClient(async (client) => {
      const res = await client.query(
        `UPDATE reports SET status = $2, notes = $3, resolved_at = CASE WHEN $2 IN ('resolved','dismissed') THEN now() ELSE resolved_at END
         WHERE id = $1 RETURNING *`,
        [id, status, notes.slice(0, 400)],
      );
      return res.rows[0] ? rowReport(res.rows[0]) : null;
    });
    if (row) await writeAudit(`report.${status}`, row.targetType, row.targetId, notes);
    return row;
  }
  const meta = await loadOpsMeta();
  const row = meta.reports.find((r) => r.id === id);
  if (!row) return null;
  row.status = status;
  row.notes = notes.slice(0, 400);
  if (status === "resolved" || status === "dismissed") row.resolvedAt = nowIso();
  saveOpsMeta();
  await writeAudit(`report.${status}`, row.targetType, row.targetId, notes);
  return row;
}

export async function listAudit() {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT 200`);
      return res.rows.map(
        (row): OpsAudit => ({
          id: String(row.id),
          action: String(row.action),
          targetType: String(row.target_type || ""),
          targetId: String(row.target_id || ""),
          detail: String(row.detail || ""),
          createdAt: new Date(String(row.created_at)).toISOString(),
        }),
      );
    });
  }
  return (await loadOpsMeta()).audit.slice(0, 200);
}

export function kindLabel(kind: string) {
  if (kind === "note") return "Photo";
  if (kind === "clip") return "Reel";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function reportTargetHref(type: string, id: string) {
  if (type === "user") return `/people/${id}`;
  if (type === "post") return `/content/${id}`;
  if (type === "shop") return `/shops/${id}`;
  if (type === "live") return `/live`;
  if (type === "comment") return `/content`;
  return `/reports`;
}

function sourceLabel(source: OpsReport["source"]) {
  if (source === "robot") return "Robot";
  if (source === "user") return "Member flag";
  return "This desk";
}

export async function hydrateReports(reports: OpsReport[]) {
  return withDb((db) => {
    const users = Object.fromEntries(db.users.map((u) => [u.id, u]));
    const posts = Object.fromEntries(db.posts.map((p) => [p.id, p]));
    const comments = Object.fromEntries((db.comments ?? []).map((c) => [c.id, c]));
    return reports.map((r) => {
      let title = `${r.targetType} ${r.targetId}`;
      let preview = r.reason;
      let href = reportTargetHref(r.targetType, r.targetId);
      if (r.targetType === "user") {
        const u = users[r.targetId];
        title = u?.name || r.targetId;
        preview = r.reason;
        href = `/people/${r.targetId}`;
      } else if (r.targetType === "post") {
        const p = posts[r.targetId];
        title = p?.title || r.targetId;
        preview = r.reason;
        href = `/content/${r.targetId}`;
      } else if (r.targetType === "comment") {
        const c = comments[r.targetId];
        const p = c ? posts[c.postId] : undefined;
        title = c?.body?.slice(0, 80) || r.targetId;
        preview = p ? `On “${p.title || p.kind}”` : r.reason;
        href = c ? `/content/${c.postId}` : "/comments";
      } else if (r.targetType === "shop") {
        title = `Shop ${r.targetId}`;
        href = `/shops/${r.targetId}`;
      }
      return {
        ...r,
        title,
        preview,
        href,
        sourceLabel: sourceLabel(r.source),
      };
    });
  });
}

export async function purgeSyntheticReports() {
  const reports = await listReports("all");
  const junk = reports.filter(
    (r) =>
      r.source === "robot" &&
      (r.reason.startsWith("Integrity robot") || r.reason.includes("likely spam or repeated")),
  );
  if (!junk.length) return;
  const ids = new Set(junk.map((r) => r.id));
  if (usingPostgres()) {
    await ensureSchema();
    await withClient((client) => client.query(`DELETE FROM reports WHERE id = ANY($1::text[])`, [junk.map((r) => r.id)]));
  } else {
    const meta = await loadOpsMeta();
    meta.reports = meta.reports.filter((r) => !ids.has(r.id));
    saveOpsMeta();
  }
}

export async function opsFlaggedComments() {
  const settings = await getOpsSettings();
  const words = blockedWordList(settings.blockedWords);
  const reports = (await listReports("all")).filter((r) => r.targetType === "comment");
  return withDb((db) => {
    const users = Object.fromEntries(db.users.map((u) => [u.id, u]));
    const posts = Object.fromEntries(db.posts.map((p) => [p.id, p]));
    const byId = Object.fromEntries((db.comments ?? []).map((c) => [c.id, c]));
    const fromReports = reports.map((r) => {
      const c = byId[r.targetId];
      return {
        id: r.id,
        commentId: r.targetId,
        body: c?.body || r.reason,
        createdAt: r.createdAt,
        authorId: c?.authorId || "",
        authorName: c ? users[c.authorId]?.name || "Unknown" : "Unknown",
        postId: c?.postId || "",
        postTitle: c ? posts[c.postId]?.title || c.postId : "",
        sourceLabel: sourceLabel(r.source),
        reason: r.reason,
        status: r.status,
      };
    });
    if (!settings.commentRobot && !settings.wordRobot) return fromReports;
    const extra = (db.comments ?? [])
      .filter((c) => !reports.some((r) => r.targetId === c.id))
      .map((c) => {
        const hits = textHitsWords(c.body, words);
        if (!hits.length) return null;
        return {
          id: `word_${c.id}`,
          commentId: c.id,
          body: c.body,
          createdAt: c.createdAt,
          authorId: c.authorId,
          authorName: users[c.authorId]?.name || "Unknown",
          postId: c.postId,
          postTitle: posts[c.postId]?.title || c.postId,
          sourceLabel: "Word robot",
          reason: `Matched: ${hits.join(", ")}`,
          status: "open" as const,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    return [...fromReports, ...extra];
  });
}

export async function opsRobotFleet() {
  const settings = await getOpsSettings();
  const words = blockedWordList(settings.blockedWords);
  const hits = await withDb((db) => {
    const wordHits = words.length
      ? db.posts.filter((p) => textHitsWords(`${p.title} ${p.body}`, words).length).length
      : 0;
    const commentHits = words.length
      ? (db.comments ?? []).filter((c) => textHitsWords(c.body, words).length).length
      : 0;
    return { wordHits, commentHits, hidden: db.posts.filter((p) => p.hidden).length };
  });
  return {
    settings,
    wordCount: words.length,
    robots: [
      {
        id: "word",
        name: "Word filter",
        on: settings.wordRobot,
        detail: words.length ? `${words.length} watched words · ${hits.wordHits} posts match` : "Add words in Settings",
      },
      {
        id: "comment",
        name: "Comment filter",
        on: settings.commentRobot,
        detail: words.length ? `${hits.commentHits} comments match watched words` : "Watches comment text against your word list",
      },
      {
        id: "live",
        name: "Live safety",
        on: settings.liveRobot,
        detail: settings.liveMinFollowers
          ? `Hosts need ${settings.liveMinFollowers}+ followers`
          : "Ready when you set live rules in Settings",
      },
    ],
    hidden: hits.hidden,
  };
}

export type OpsAlert = {
  id: string;
  tone: "live" | "report" | "shop" | "robot" | "account";
  title: string;
  detail: string;
  href: string;
  when: string;
};

export async function opsHeaderState() {
  await purgeSyntheticReports();
  const [shops, live, reports] = await Promise.all([shopCounts(), listLiveSessions(), listReports("all")]);
  const openReports = reports.filter((r) => r.status === "open" || r.status === "reviewing");
  const robotFiltered = reports.filter((r) => r.source === "robot" && (r.status === "open" || r.status === "reviewing")).length;
  const alerts: OpsAlert[] = [];
  if (live.length) {
    alerts.push({
      id: "live",
      tone: "live",
      title: `${live.length} live now`,
      detail: live.map((s) => s.title).slice(0, 2).join(" · "),
      href: "/live",
      when: live[0]?.startedAt || nowIso(),
    });
  }
  if (shops.pending) {
    alerts.push({
      id: "shops",
      tone: "shop",
      title: `${shops.pending} shop applications`,
      detail: "Waiting on verification",
      href: "/shops?status=pending",
      when: nowIso(),
    });
  }
  if (openReports.length) {
    alerts.push({
      id: "reports",
      tone: "report",
      title: `${openReports.length} reports`,
      detail: openReports[0]?.reason || "",
      href: "/reports",
      when: openReports[0]?.createdAt || nowIso(),
    });
  }
  const desk = (await listAudit()).filter((r) => r.action.startsWith("desk.")).slice(0, 8);
  return {
    pendingShops: shops.pending,
    liveNow: live.length,
    openReports: openReports.length,
    robotFiltered,
    hidden: 0,
    alerts,
    notices: desk.map((row) => ({
      id: row.id,
      action: row.action.replace("desk.", ""),
      detail: row.detail,
      createdAt: row.createdAt,
    })),
  };
}

export async function opsReportDesk() {
  const reports = await hydrateReports(await listReports("all"));
  return {
    reports,
    open: reports.filter((r) => r.status === "open").length,
    reviewing: reports.filter((r) => r.status === "reviewing").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    dismissed: reports.filter((r) => r.status === "dismissed").length,
  };
}

export async function writeDeskEvent(action: string, detail = "") {
  await writeAudit(`desk.${action}`, "desk", "", detail);
}

export async function listDeskActivity() {
  return (await listAudit()).filter((r) => r.action.startsWith("desk.") || r.targetType === "desk");
}

function rowWithdrawal(row: Record<string, unknown>, name = ""): OpsWithdrawal & { name?: string } {
  const micros = Number(row.amount_micros || 0);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    amountMicros: micros,
    amountLabel: formatUsd(micros),
    status: (row.status as OpsWithdrawal["status"]) || "pending",
    method: String(row.method || ""),
    notes: String(row.notes || ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : undefined,
    name,
  };
}

export async function listWithdrawals(status: OpsWithdrawal["status"] | "all" = "all") {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res =
        status === "all"
          ? await client.query(`SELECT * FROM wallet_withdrawals ORDER BY created_at DESC LIMIT 200`)
          : await client.query(`SELECT * FROM wallet_withdrawals WHERE status = $1 ORDER BY created_at DESC LIMIT 200`, [status]);
      return res.rows;
    });
    const names = await withDb((db) => Object.fromEntries(db.users.map((u) => [u.id, u.name])));
    return rows.map((r) => rowWithdrawal(r, names[String(r.user_id)] || "Unknown"));
  }
  const meta = await loadOpsMeta();
  const names = await withDb((db) => Object.fromEntries(db.users.map((u) => [u.id, u.name])));
  const list = (meta.withdrawals ?? []).map((w) => ({ ...w, name: names[w.userId] || "Unknown" }));
  return status === "all" ? list : list.filter((w) => w.status === status);
}

export async function requestWithdrawal(userId: string, method = "") {
  const settings = await getOpsSettings();
  const user = await withDb((db) => db.users.find((u) => u.id === userId) || null);
  if (!user) return { error: "missing" as const };
  const min = Math.round(settings.payoutThresholdUsd * 1_000_000);
  if (user.balanceMicros < min) return { error: "threshold" as const };
  const pending = (await listWithdrawals("pending")).filter((w) => w.userId === userId);
  if (pending.length) return { error: "pending" as const };
  const row: OpsWithdrawal = {
    id: `wd_${crypto.randomUUID()}`,
    userId,
    amountMicros: user.balanceMicros,
    amountLabel: formatUsd(user.balanceMicros),
    status: "pending",
    method: method.slice(0, 80),
    notes: "",
    createdAt: nowIso(),
  };
  if (usingPostgres()) {
    await ensureSchema();
    await withClient((client) =>
      client.query(
        `INSERT INTO wallet_withdrawals (id, user_id, amount_micros, status, method, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [row.id, row.userId, row.amountMicros, row.status, row.method, row.notes, row.createdAt],
      ),
    );
  } else {
    const meta = await loadOpsMeta();
    meta.withdrawals = [row, ...(meta.withdrawals ?? [])];
    saveOpsMeta();
  }
  return { ok: true as const, row };
}

export async function resolveWithdrawal(id: string, status: "approved" | "rejected" | "paid") {
  const rows = await listWithdrawals("all");
  const current = rows.find((w) => w.id === id);
  if (!current) return false;
  if (status === "approved" || status === "paid") {
    const ok = await withDb((db) => {
      const user = db.users.find((u) => u.id === current.userId);
      if (!user || user.balanceMicros < current.amountMicros) return false;
      user.balanceMicros -= current.amountMicros;
      db.ledger.push({
        id: `led_${crypto.randomUUID()}`,
        userId: current.userId,
        postId: null,
        source: "payout",
        micros: -current.amountMicros,
        createdAt: nowIso(),
      });
      return true;
    }, true);
    if (!ok) return false;
  }
  const nextStatus = status === "approved" ? "paid" : status;
  if (usingPostgres()) {
    await ensureSchema();
    await withClient((client) =>
      client.query(`UPDATE wallet_withdrawals SET status = $2, resolved_at = now() WHERE id = $1`, [id, nextStatus]),
    );
  } else {
    const meta = await loadOpsMeta();
    const row = (meta.withdrawals ?? []).find((w) => w.id === id);
    if (row) {
      row.status = nextStatus;
      row.resolvedAt = nowIso();
      saveOpsMeta();
    }
  }
  await writeAudit(`wallet.${nextStatus}`, "user", current.userId, current.amountLabel);
  return true;
}

