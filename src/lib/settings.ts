export type FollowWho = "everyone" | "approved" | "nobody";

export type AdCampaign = {
  id: string;
  title: string;
  promote: "profile" | "shop" | "link";
  link?: string;
  dailyBudget: number;
  status: "running" | "paused" | "ended";
  createdAt: string;
};

export type UserSettings = {
  privateAccount: boolean;
  followWho: FollowWho;
  theme: "light" | "dark";
  adsOnLive: boolean;
  adsPersonalized: boolean;
  adsHidden: string[];
  verifyRequested: boolean;
  adCampaigns: AdCampaign[];
};

export const AD_TOPICS = ["Alcohol", "Gambling", "Dating", "Politics", "Weight loss", "Crypto"] as const;

export function defaultSettings(): UserSettings {
  return {
    privateAccount: false,
    followWho: "everyone",
    theme: "light",
    adsOnLive: true,
    adsPersonalized: true,
    adsHidden: [],
    verifyRequested: false,
    adCampaigns: [],
  };
}

export function mergeSettings(raw: unknown): UserSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<UserSettings>;
  return {
    privateAccount: !!s.privateAccount,
    followWho: s.followWho === "approved" || s.followWho === "nobody" ? s.followWho : "everyone",
    theme: s.theme === "dark" ? "dark" : "light",
    adsOnLive: s.adsOnLive !== false,
    adsPersonalized: s.adsPersonalized !== false,
    adsHidden: Array.isArray(s.adsHidden) ? s.adsHidden.map(String) : [],
    verifyRequested: !!s.verifyRequested,
    adCampaigns: Array.isArray(s.adCampaigns) ? s.adCampaigns.filter(isCampaign) : [],
  };
}

function isCampaign(raw: unknown): raw is AdCampaign {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as AdCampaign;
  return Boolean(c.id && c.title && (c.promote === "profile" || c.promote === "shop" || c.promote === "link"));
}

export function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem("cp_theme", theme);
  } catch {
    /* ignore */
  }
}
