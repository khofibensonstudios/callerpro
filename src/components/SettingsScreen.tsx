"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";
import { AD_TOPICS, applyTheme, defaultSettings, type FollowWho, type UserSettings } from "@/lib/settings";
import { shareUrl } from "@/lib/share";
import { AdsManager } from "./AdsManager";
import { APP_NAME } from "@/lib/constants";

const VIEWS = ["main", "guidelines", "blocked", "ads", "login", "follow"] as const;
type View = (typeof VIEWS)[number];

type BlockedPerson = {
  id: string;
  name: string;
  headline?: string;
  avatarHue: number;
  avatarUrl?: string;
};

function readView(raw: string | null): View {
  return VIEWS.includes(raw as View) && raw !== "main" ? (raw as View) : "main";
}

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = readView(searchParams.get("v"));
  const [settings, setSettings] = useState<UserSettings>(defaultSettings());
  const [balance, setBalance] = useState("$0.00");
  const [email, setEmail] = useState("");
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [copied, setCopied] = useState(false);
  const [shopLabel, setShopLabel] = useState("Off");

  useEffect(() => {
    fetch("/api/shop/mine", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const status = d.shop?.status as string | undefined;
        if (status === "verified") setShopLabel("On");
        else if (status === "pending") setShopLabel("Pending");
        else if (status === "setup") setShopLabel("Setup");
        else setShopLabel("Off");
      })
      .catch(() => {});
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setSettings(d.settings);
          applyTheme(d.settings.theme);
        }
      })
      .catch(() => {});
    fetch("/api/earnings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.balanceLabel) setBalance(d.balanceLabel);
      })
      .catch(() => {});
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.email) setEmail(d.user.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "blocked") return;
    fetch("/api/blocks", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBlocked(d.people ?? []))
      .catch(() => {});
  }, [view]);

  function openView(next: View) {
    if (next === "main") router.push("/settings");
    else router.push(`/settings?v=${next}`);
  }

  function back() {
    if (view !== "main") {
      router.push("/settings");
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else window.location.assign("/profile");
  }

  async function patch(partial: Partial<UserSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    if (partial.theme) applyTheme(partial.theme);
    await fetch("/api/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
  }

  async function shareProfile() {
    if (!user) return;
    const result = await shareUrl(`${window.location.origin}/u/${user.id}`);
    if (result === "copied" || result === "shared") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  async function unblock(id: string) {
    const res = await fetch("/api/blocks", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    const d = await res.json();
    if (res.ok) setBlocked(d.people ?? []);
  }

  const titles: Record<View, string> = {
    main: "Settings",
    guidelines: "Community guidelines",
    blocked: "Blocked accounts",
    ads: "Ads manager",
    login: "Login activity",
    follow: "Who can follow you",
  };

  return (
    <div className="px-5 pt-2 pb-8">
      <div className="flex items-center gap-1">
        <button type="button" onClick={back} className="-ml-2 grid h-10 w-10 place-items-center" aria-label="Back">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">{titles[view]}</h1>
      </div>

      {view === "main" ? (
        <div className="mt-5 space-y-6">
          <Group title="Account">
            <Row label="Community guidelines" onClick={() => openView("guidelines")} />
            <Row label="Balance" value={balance} onClick={() => router.push("/earn")} />
            <Row label="Shop" value={shopLabel} onClick={() => router.push("/shop/setup")} />
            <Row label="Share profile" value={copied ? "Copied" : undefined} onClick={() => void shareProfile()} />
            <Row label="Blocked accounts" onClick={() => openView("blocked")} />
          </Group>

          <Group title="Privacy">
            <ToggleRow label="Private account" on={settings.privateAccount} onChange={(v) => void patch({ privateAccount: v })} />
            <Row label="Who can follow you" value={followLabel(settings.followWho)} onClick={() => openView("follow")} />
            <Row label="Login activity" onClick={() => openView("login")} />
          </Group>

          <Group title="App">
            <ToggleRow
              label="Dark mode"
              on={settings.theme === "dark"}
              onChange={(v) => void patch({ theme: v ? "dark" : "light" })}
            />
            <Row label="Ads manager" onClick={() => openView("ads")} />
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-12 w-full items-center px-4 text-left text-[15px] font-medium text-[#ff3b30]"
            >
              Sign out
            </button>
          </Group>
        </div>
      ) : null}

      {view === "guidelines" ? (
        <div className="mt-6">
          <p className="text-sm text-fb-muted">How we keep {APP_NAME} in order.</p>
          <ol className="mt-5 divide-y divide-black/10 border-y border-black/10">
            {[
              "Be respectful. No hate, harassment, or threats.",
              "Post only what you have the rights to. Stolen work gets removed.",
              "No spam, fake engagement, or clicking your own ads.",
              "If something feels wrong, report it. We review reports and can restrict or close accounts.",
            ].map((line, i) => (
              <li key={line} className="flex gap-3 py-4">
                <span className="w-5 shrink-0 text-sm font-bold">{i + 1}</span>
                <p className="text-[15px] leading-6">{line}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {view === "blocked" ? (
        <div className="mt-6">
          <p className="text-sm text-fb-muted">People you blocked cannot see your profile or message you.</p>
          {!blocked.length ? (
            <p className="mt-4 text-sm text-fb-muted">You have not blocked anyone.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
              {blocked.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={40} userId={p.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    {p.headline ? <span className="block truncate text-xs text-fb-muted">{p.headline}</span> : null}
                  </span>
                  <button type="button" onClick={() => void unblock(p.id)} className="text-sm font-semibold">
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {view === "follow" ? (
        <div className="mt-6">
          <p className="text-sm text-fb-muted">Choose who is allowed to follow you.</p>
          <div className="mt-4 divide-y divide-black/10 border-y border-black/10">
            {(
              [
                ["everyone", "Everyone", "Anyone can follow you"],
                ["approved", "Approved only", "You choose who can follow"],
                ["nobody", "Nobody", "Turn off new follows"],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => void patch({ followWho: id as FollowWho })}
                className="flex w-full items-center gap-3 py-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{label}</span>
                  <span className="mt-0.5 block text-[13px] text-fb-muted">{hint}</span>
                </span>
                {settings.followWho === id ? <Check className="h-5 w-5 shrink-0" strokeWidth={2.4} /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === "login" ? (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-fb-muted uppercase">This session</p>
          <div className="mt-4 flex items-center gap-3 border-y border-black/10 py-4">
            {user ? <Avatar name={user.name} hue={user.avatarHue} src={user.avatarUrl} size={44} userId={user.id} /> : null}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{user?.name ?? "You"}</span>
              {email ? <span className="block truncate text-[13px] text-fb-muted">{email}</span> : null}
              <span className="mt-1 block text-[12px] text-fb-muted">{deviceLabel()} · Active now</span>
            </span>
          </div>
        </div>
      ) : null}

      {view === "ads" ? (
        <AdsManager campaigns={settings.adCampaigns ?? []} onChange={(adCampaigns) => void patch({ adCampaigns })} />
      ) : null}
    </div>
  );
}

function followLabel(who: FollowWho) {
  if (who === "approved") return "Approved";
  if (who === "nobody") return "Nobody";
  return "Everyone";
}

function deviceLabel() {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "Mac";
  return "This device";
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-fb-muted uppercase">{title}</p>
      <div className="overflow-hidden rounded-xl bg-white [&>*+*]:border-t [&>*+*]:border-black/[0.07]">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex h-12 w-full items-center gap-3 px-4 text-left">
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{label}</span>
      {value ? <span className="max-w-[7rem] shrink-0 truncate text-[13px] text-fb-muted">{value}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-[#c4bfb7]" />
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
  flush,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  flush?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${flush ? "py-3" : "h-12 px-4"} ${hint && !flush ? "h-auto py-3 px-4" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] leading-4 text-fb-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-[#e85d04]" : "bg-[#d9d3cb]"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
