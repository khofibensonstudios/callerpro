import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/constants";
import { postPath } from "@/lib/seed-content";
import { withDb } from "@/lib/store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { posts, users } = await withDb((db) => ({ posts: db.posts, users: db.users }));
  const staticPages = [
    "/about",
    "/privacy",
    "/terms",
    "/contact",
    "/how-adsense-works",
    "/friends",
    "/shop",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const postPages = posts
    .filter((p) => p.kind !== "blog")
    .map((p) => ({
    url: `${base}${postPath(p.id, p.kind)}`,
    lastModified: new Date(p.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const profiles = users
    .filter((u) => u.onboarded)
    .map((u) => ({
      url: `${base}/u/${u.id}`,
      lastModified: new Date(u.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [...staticPages, ...postPages, ...profiles];
}
