import { WithdrawalButtons } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsAvatar, OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { listWithdrawals, opsWallet } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const view = tab === "ledger" ? "ledger" : "accounts";
  const [data, pending, allWd] = await Promise.all([opsWallet(), listWithdrawals("pending"), listWithdrawals("all")]);

  return (
    <>
      <OpsTitle
        title="Wallet"
        extra={
          <p className="ops-muted text-sm">
            Held {data.heldLabel} · lifetime {data.lifetimeLabel}
          </p>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <a href={opsHref("/wallet")} className={`ops-chip ${view === "accounts" ? "ops-chip-on" : ""}`}>
          Accounts
        </a>
        <a href={opsHref("/wallet?tab=ledger")} className={`ops-chip ${view === "ledger" ? "ops-chip-on" : ""}`}>
          Ledger
        </a>
      </div>

      <p className="mb-2 font-bold">Withdrawal requests</p>
      {pending.length === 0 ? (
        <p className="ops-muted mb-6 text-sm">No pending withdrawals. Requests appear when a creator asks to cash out at or above the threshold in Settings.</p>
      ) : (
        <div className="mb-6">
          <OpsTable>
            <thead>
              <tr>
                <th>Person</th>
                <th>Amount</th>
                <th>Method</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((w) => (
                <tr key={w.id}>
                  <td>
                    <a href={opsHref(`/people/${w.userId}`)} className="font-semibold">
                      {"name" in w ? String(w.name) : w.userId}
                    </a>
                  </td>
                  <td className="font-semibold">{w.amountLabel}</td>
                  <td className="ops-muted">{w.method || "—"}</td>
                  <td className="ops-muted">{timeAgo(w.createdAt)}</td>
                  <td>
                    <WithdrawalButtons id={w.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </OpsTable>
        </div>
      )}

      {view === "ledger" ? (
        allWd.length === 0 && data.recent.length === 0 ? (
          <OpsEmpty title="No ledger yet" body="Credits and payouts show here." />
        ) : (
          <OpsTable>
            <thead>
              <tr>
                <th>Person</th>
                <th>Source</th>
                <th>Amount</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((l) => (
                <tr key={l.id}>
                  <td>
                    <a href={opsHref(`/people/${l.userId}`)} className="font-semibold">
                      {l.name}
                    </a>
                  </td>
                  <td className="capitalize">{l.source}</td>
                  <td>{l.amount}</td>
                  <td className="ops-muted">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </OpsTable>
        )
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Person</th>
              <th>Held</th>
              <th>Lifetime</th>
            </tr>
          </thead>
          <tbody>
            {data.top.map((u) => (
              <tr key={u.id}>
                <td>
                  <a href={opsHref(`/people/${u.id}`)} className="flex items-center gap-3">
                    <OpsAvatar src={u.avatarUrl} name={u.name} />
                    <span className="font-semibold">{u.name}</span>
                  </a>
                </td>
                <td className="font-semibold">{u.balanceLabel}</td>
                <td className="ops-muted">{u.lifetimeLabel}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
