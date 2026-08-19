export const SKILLS = [
  "Music",
  "Comedy",
  "Teaching",
  "Fitness",
  "Cooking",
  "Tech",
  "Design",
  "Writing",
  "Beauty",
  "Sports",
  "Business",
  "Gaming",
  "DIY",
  "Language",
  "Photography",
  "Dance",
  "Finance",
  "Health",
  "Fashion",
  "Storytelling",
] as const;

export type Skill = (typeof SKILLS)[number];

export const APP_NAME = "Caller Pro";

export const FORMATS = [
  { id: "video", label: "Video" },
  { id: "note", label: "Photo" },
] as const;

export const DEFAULT_PORTRAITS = [
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80",
] as const;

export function defaultPortrait(seed: string | number) {
  const n =
    typeof seed === "number"
      ? seed
      : [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return DEFAULT_PORTRAITS[Math.abs(n) % DEFAULT_PORTRAITS.length];
}

export type PostKind = (typeof FORMATS)[number]["id"];

/** 70% of attributed ad revenue goes to the creator. */
export const CREATOR_SHARE = 0.7;

export const VIEW_RPM_USD = 4;
export const AD_IMPRESSION_RPM_USD = 8;
export const PAYOUT_THRESHOLD_USD = 10;

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}
