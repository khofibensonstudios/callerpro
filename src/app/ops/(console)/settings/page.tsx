import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsPanel } from "@/components/ops/OpsUi";
import { saveOpsSettingsAction } from "@/app/ops/actions";
import { getOpsSettings } from "@/lib/ops-settings";

export const dynamic = "force-dynamic";

export default async function OpsSettingsPage() {
  const s = await getOpsSettings();
  return (
    <>
      <OpsTitle title="Settings" />
      <form action={saveOpsSettingsAction} className="grid max-w-3xl gap-4">
        <OpsPanel>
          <p className="font-bold">Appearance</p>
          <p className="ops-muted mt-1 text-sm">Light is the default. Dark is opt-in here.</p>
          <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="dark" defaultChecked={s.theme === "dark"} />
            Dark desk
          </label>
        </OpsPanel>
        <OpsPanel>
          <p className="font-bold">Watched words</p>
          <p className="ops-muted mt-1 text-sm">Robots use this list. One word or phrase per line.</p>
          <textarea name="blockedWords" defaultValue={s.blockedWords} rows={8} className="mt-3 w-full rounded-xl border px-3 py-3 text-sm" />
          <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="wordRobot" defaultChecked={s.wordRobot} />
            Word filter robot
          </label>
          <label className="mt-2 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="commentRobot" defaultChecked={s.commentRobot} />
            Comment filter robot
          </label>
          <label className="mt-2 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="autoHold" defaultChecked={s.autoHold} />
            Auto-hold posts that match watched words
          </label>
        </OpsPanel>
        <OpsPanel>
          <p className="font-bold">Live</p>
          <label className="mt-3 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="liveRobot" defaultChecked={s.liveRobot} />
            Live safety robot
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Minimum followers to go live
            <input name="liveMinFollowers" type="number" min={0} defaultValue={s.liveMinFollowers} className="mt-2 h-10 w-40 rounded-xl border px-3" />
          </label>
        </OpsPanel>
        <OpsPanel>
          <p className="font-bold">Wallet</p>
          <label className="mt-3 block text-sm font-semibold">
            Withdrawal threshold (USD)
            <input name="payoutThresholdUsd" type="number" min={1} step="1" defaultValue={s.payoutThresholdUsd} className="mt-2 h-10 w-40 rounded-xl border px-3" />
          </label>
        </OpsPanel>
        <button className="ops-btn ops-btn-primary w-fit">Save</button>
      </form>
    </>
  );
}
