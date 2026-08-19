import { listPublicProducts } from "@/lib/shop";
import { publicUser, toClientPost, withDb } from "@/lib/store";

const SHOP_HINTS =
  /\b(shop|buy|product|cheap|price|afford|deal|store|order|cart|budget|item|sell|purchase|cost)\b/i;
const LEARN_HINTS =
  /\b(learn|training|tutorial|teach|how to|course|video|content|watch|skill|practice|lesson|tip)\b/i;

function wordsFrom(text: string) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2);
}

export async function gatherLeraContext(message: string) {
  const parts: string[] = [];
  const q = message.trim();
  const words = wordsFrom(q);
  const wantsShop = SHOP_HINTS.test(q);
  const wantsLearn = LEARN_HINTS.test(q);

  if (wantsShop) {
    let products = await listPublicProducts();
    if (words.length) {
      products = products.filter((p) => {
        const hay = `${p.name} ${p.description} ${p.category} ${p.shopName}`.toLowerCase();
        return words.some((w) => hay.includes(w));
      });
    }
    if (/\b(cheap|afford|budget|lowest|deal|inexpensive)\b/i.test(q)) {
      products = [...products].sort((a, b) => a.priceCents - b.priceCents);
    } else {
      products = [...products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    const top = products.slice(0, 6);
    if (top.length) {
      parts.push("SHOP PRODUCTS (share name, price, and path /shop/p/{slug}):");
      for (const p of top) {
        parts.push(
          `- ${p.name} — $${(p.priceCents / 100).toFixed(2)} — ${p.shopName} (${p.category}) — /shop/p/${p.slug}`,
        );
      }
    }
  }

  if (wantsLearn) {
    const items = await withDb((db) => {
      let posts = db.posts.filter((p) => p.published !== false && p.kind !== "blog");
      if (words.length) {
        posts = posts.filter((p) => {
          const hay = `${p.title} ${p.body} ${p.skill}`.toLowerCase();
          return words.some((w) => hay.includes(w));
        });
      }
      return posts
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 6)
        .map((post) => {
          const author = db.users.find((u) => u.id === post.authorId);
          const client = toClientPost(post);
          const path = `/p/${post.id}`;
          return {
            title: client.title || post.skill,
            kind: post.kind,
            skill: post.skill,
            path,
            author: author ? publicUser(author).name : "Creator",
          };
        });
    });
    if (items.length) {
      parts.push("TRAINING / CONTENT on Connect Pro (share title and path):");
      for (const item of items) {
        parts.push(`- [${item.kind}] ${item.title} by ${item.author} (${item.skill}) — ${item.path}`);
      }
    }
  }

  return parts.join("\n");
}
