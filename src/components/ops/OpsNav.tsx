"use client";

import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Clapperboard,
  Flag,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Radio,
  Settings,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { opsHref } from "@/lib/ops-path";

type Counts = {
  pendingShops: number;
  liveNow: number;
  openReports: number;
};

const ITEMS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/content", label: "Content", icon: Clapperboard },
  { href: "/comments", label: "Comments", icon: MessageSquareText },
  { href: "/live", label: "Live", icon: Radio, badge: "liveNow" as const },
  { href: "/reports", label: "Reports", icon: Flag, badge: "openReports" as const },
  { href: "/robots", label: "Robots", icon: Bot },
  { href: "/shops", label: "Shops", icon: Store, badge: "pendingShops" as const },
  { href: "/products", label: "Products", icon: Package },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/audit", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function OpsNav({ counts }: { counts: Counts }) {
  const path = usePathname();
  const badge: Record<string, number> = {
    liveNow: counts.liveNow,
    openReports: counts.openReports,
    pendingShops: counts.pendingShops,
  };

  return (
    <nav className="ops-nav-scroll mt-8 flex-1 overflow-y-auto pr-1">
      {ITEMS.map((item) => {
        const href = opsHref(item.href);
        const active = item.href === "" ? path === href : path === href || path.startsWith(`${href}/`);
        const Icon = item.icon;
        const n = "badge" in item && item.badge ? badge[item.badge] || 0 : 0;
        return (
          <a
            key={item.href || "home"}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
              active ? "text-[var(--ops-accent)]" : "text-[var(--ops-text)] opacity-80 hover:opacity-100"
            }`}
          >
            <Icon size={16} strokeWidth={active ? 2.4 : 2} />
            <span className="flex-1">{item.label}</span>
            {n > 0 ? (
              <span className="min-w-5 rounded-full bg-[#e85d04] px-1.5 text-center text-[11px] font-bold text-white">{n}</span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
