import { OpsTitle } from "@/components/ops/OpsShell";
import { KindPill, OpsAvatar, OpsBadge, OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { opsContentPulse, opsPosts } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { compactCount, timeAgo } from "@/lib/time";
import type { PostKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: { id: "all" | PostKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "clip", label: "Reels" },
  { id: "note", label: "Photos" },
  { id: "blog", label: "Blogs" },
  { id: "story", label: "Stories" },
];

export default async function OpsContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; vis?: string; sort?: string }>;
}) {
  const { q = "", kind: raw, vis, sort: sortRaw } = await searchParams;
  const kind = (["video", "clip", "note", "blog", "story"] as const).includes(raw as PostKind) ? (raw as PostKind) : "all";
  const visibility = vis === "hidden" || vis === "live" ? vis : "all";
  const sort = sortRaw === "new" ? "new" : "performance";
  const [posts, pulse] = await Promise.all([opsPosts(q, kind, visibility, sort), opsContentPulse()]);
  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, kind, vis: visibility, sort, ...next };
    if (merged.q) p.set("q", merged.q);
    if (merged.kind !== "all") p.set("kind", merged.kind);
    if (merged.vis !== "all") p.set("vis", merged.vis);
    if (merged.sort !== "performance") p.set("sort", merged.sort);
    const s = p.toString();
    return opsHref(s ? `/content?${s}` : "/content");
  };

  return (
    <>
      <OpsTitle title="Content" extra={<p className="ops-muted text-sm">{posts.length} shown · {pulse.total} in library</p>} />
      <form action={opsHref("/content")} className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Title, author, id" className="h-10 min-w-[220px] flex-1 rounded-full border px-4" />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="vis" value={visibility} />
        <input type="hidden" name="sort" value={sort} />
        <button className="ops-btn ops-btn-primary">Search</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((tab) => (
          <a key={tab.id} href={qs({ kind: tab.id })} className={`ops-chip ${kind === tab.id ? "ops-chip-on" : ""}`}>
            {tab.label}
          </a>
        ))}
        <span className="mx-2 h-8 w-px bg-[var(--ops-line)]" />
        {(["all", "live", "hidden"] as const).map((v) => (
          <a key={v} href={qs({ vis: v })} className={`ops-chip ${visibility === v ? "ops-chip-on" : ""}`}>
            {v === "live" ? "On feed" : v === "hidden" ? "Held" : "Any state"}
          </a>
        ))}
        <span className="mx-2 h-8 w-px bg-[var(--ops-line)]" />
        <a href={qs({ sort: "performance" })} className={`ops-chip ${sort === "performance" ? "ops-chip-on" : ""}`}>
          Performance
        </a>
        <a href={qs({ sort: "new" })} className={`ops-chip ${sort === "new" ? "ops-chip-on" : ""}`}>
          Newest
        </a>
      </div>
      {posts.length === 0 ? (
        <OpsEmpty title="Nothing in this list" body="Change format, state, or search." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Post</th>
              <th>Author</th>
              <th>Type</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Earn</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={opsHref(`/content/${p.id}`)} className="flex items-center gap-3">
                    {p.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : null}
                    <span>
                      <span className="block max-w-[280px] truncate font-semibold">{p.title}</span>
                      {p.hidden ? <OpsBadge tone="danger">Held</OpsBadge> : null}
                    </span>
                  </a>
                </td>
                <td>
                  <a href={opsHref(`/people/${p.authorId}`)} className="inline-flex items-center gap-2">
                    <OpsAvatar src={p.authorAvatar} name={p.authorName} size={24} />
                    {p.authorName}
                  </a>
                </td>
                <td>
                  <KindPill kind={p.kind} />
                </td>
                <td>{compactCount(p.views)}</td>
                <td>{p.likes}</td>
                <td>
                  <a href={opsHref(`/content/${p.id}`)} className="font-semibold text-[#e85d04]">
                    {p.comments}
                  </a>
                </td>
                <td>{p.earnLabel}</td>
                <td className="ops-muted">{timeAgo(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
