import { CommentDeleteButton } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsBadge, OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { opsFlaggedComments } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsCommentsPage() {
  const rows = await opsFlaggedComments();
  return (
    <>
      <OpsTitle title="Comments" extra={<p className="ops-muted text-sm">Flagged only</p>} />
      {rows.length === 0 ? (
        <OpsEmpty
          title="No flagged comments"
          body="This list is only comments a robot or a report marked. Open a post to read its full thread."
        />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Comment</th>
              <th>Author</th>
              <th>Post</th>
              <th>Source</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="max-w-md">
                  <p className="line-clamp-3">{c.body}</p>
                  <p className="ops-muted mt-1 text-xs">{c.reason}</p>
                </td>
                <td>
                  {c.authorId ? (
                    <a href={opsHref(`/people/${c.authorId}`)} className="font-semibold">
                      {c.authorName}
                    </a>
                  ) : (
                    c.authorName
                  )}
                </td>
                <td>
                  {c.postId ? (
                    <a href={opsHref(`/content/${c.postId}`)} className="font-semibold text-[#e85d04]">
                      {c.postTitle || "Open post"}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <OpsBadge tone={c.sourceLabel === "Robot" || c.sourceLabel === "Word robot" ? "robot" : "mute"}>{c.sourceLabel}</OpsBadge>
                </td>
                <td className="ops-muted">{timeAgo(c.createdAt)}</td>
                <td>{c.commentId ? <CommentDeleteButton id={c.commentId} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
