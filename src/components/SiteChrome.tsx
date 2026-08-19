"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Phone,
  MessageCircle,
  Plus,
  Search,
  ShoppingBag,
  Signal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import { useCart } from "./shop/CartProvider";
import { CreateFlowProvider, CreateSideButton } from "./CreateFlow";
import { PersonLink } from "./PersonLink";
import type { InboxItem } from "@/lib/inbox-shared";

type Person = {
  id: string;
  name: string;
  headline?: string;
  avatarHue: number;
  avatarUrl?: string;
};

type Trend = { id: string; title: string; kind: string };

export function SiteChrome({
  children,
  variant = "feed",
  hideBars = false,
}: {
  children: React.ReactNode;
  variant?: "feed" | "watch" | "blog" | "page" | "wide" | "reel" | "chat";
  hideBars?: boolean;
}) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const path = usePathname();
  const onShop = path.startsWith("/shop");
  const [menuOpen, setMenuOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [unread, setUnread] = useState(0);
  const profileHref = "/profile";

  useEffect(() => {
    let alive = true;
    function load() {
      fetch("/api/inbox", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          const items = (d.items ?? []) as InboxItem[];
          setUnread(items.filter((item) => Boolean(item.unread)).length);
        })
        .catch(() => {});
    }
    load();
    const t = window.setInterval(load, 8000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [user?.id, path]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) return;
    fetch("/api/creators")
      .then((r) => r.json())
      .then((d) => setPeople(d.creators ?? []))
      .catch(() => {});
    fetch("/api/trends")
      .then((r) => r.json())
      .then((d) => setTrends(d.trends ?? []))
      .catch(() => {});
  }, []);

  const tabs = [
    { href: "/messages", icon: MessageCircle, label: "Chats" },
    { href: "/calls", icon: Phone, label: "Calls" },
    { href: "/groups", icon: UsersRound, label: "Groups" },
    { href: profileHref, icon: UserRound, label: "Profile", avatar: true },
  ];
  const desktopNav = tabs;
  const shortcuts = tabs;
  const mobileNav = tabs;

  const shell =
    variant === "reel" || variant === "chat"
      ? "w-full"
      : variant === "wide"
        ? "mx-auto w-full max-w-[935px] px-0 py-0 lg:px-4 lg:py-6"
        : variant === "watch" || variant === "blog"
          ? "mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-3 py-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]"
          : variant === "page"
            ? "mx-auto grid max-w-[1280px] grid-cols-1 gap-4 px-3 py-4 lg:grid-cols-[240px_minmax(0,720px)_280px] lg:justify-center"
            : "mx-auto w-full max-w-[470px] bg-white lg:max-w-[760px] lg:grid lg:grid-cols-[220px_470px] lg:justify-center lg:gap-8 lg:bg-transparent lg:px-4 lg:py-6";

  function active(href: string, label: string) {
    if (label === "Profile") {
      if (path.startsWith("/profile") || path.startsWith("/settings")) return true;
      return Boolean(user && (path === `/u/${user.id}` || path.startsWith(`/u/${user.id}?`)));
    }
    return path.startsWith(href);
  }

  return (
    <CreateFlowProvider>
      <div
        className={`flex min-h-[100dvh] flex-col ${variant === "reel" ? "h-[100dvh] overflow-hidden bg-black" : variant === "feed" ? "bg-white lg:bg-fb-bg" : "bg-fb-bg"} ${
          variant === "chat"
            ? "h-[100dvh] overflow-hidden lg:pb-0"
            : hideBars
              ? "pb-0 lg:pb-0"
              : "pb-[calc(5.1rem+env(safe-area-inset-bottom))] lg:pb-0"
        }`}
      >
        <header className={`shrink-0 overflow-visible bg-white pt-[env(safe-area-inset-top)] lg:border-b lg:border-black/[0.08] ${hideBars || variant === "reel" ? "hidden lg:block" : ""}`}>
          <MobileAppHeader
            profileHref={profileHref}
            user={user}
            onShop={onShop}
            cartCount={count}
            path={path}
          />

          <div className="mx-auto hidden h-14 max-w-[1440px] items-center justify-between gap-4 px-4 lg:flex">
            <div className="relative flex min-w-0 flex-1 items-center gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 py-1 pr-2"
                  title="Profile"
                >
                  <Avatar name={user.name} hue={user.avatarHue} src={user.avatarUrl} size={32} />
                  <span className="max-w-[10rem] truncate text-[15px] font-semibold text-[#141414]">{user.name}</span>
                </button>
              ) : (
                <Link href="/login?next=/profile" prefetch={false} className="text-[13px] font-semibold text-[#141414]">
                  Sign in
                </Link>
              )}
              {menuOpen && user ? (
                <div className="absolute top-12 left-0 z-40 w-64 overflow-hidden rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/10">
                  <a
                    href={profileHref}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-[#f4f1eb]"
                  >
                    <Avatar name={user.name} hue={user.avatarHue} src={user.avatarUrl} size={36} />
                    <span className="font-semibold">{user.name}</span>
                  </a>
                  <Link
                    href="/shop"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-[#f4f1eb]"
                  >
                    Shop
                  </Link>
                  <Link
                    href="/earn"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-[#f4f1eb]"
                  >
                    Wallet
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#6f6a64] hover:bg-[#f4f1eb] hover:text-[#141414]"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
              <form action={onShop ? "/shop" : "/search"} className="relative hidden xl:block">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-fb-muted" />
                <input
                  name="q"
                  autoComplete="off"
                  suppressHydrationWarning
                  className="h-9 w-56 rounded-lg bg-[#f4f1eb] pr-3 pl-9 text-sm outline-none"
                  placeholder={onShop ? "Search products" : "Caller ID"}
                />
              </form>
            </div>

            <nav className="flex shrink-0 items-center gap-1">
              {desktopNav.map((item) => {
                const Icon = item.icon;
                const on = active(item.href, item.label);
                if (item.label === "Profile") {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      title="Profile"
                      className={`grid h-10 w-10 place-items-center rounded-full ${on ? "ring-2 ring-[#141414]" : ""}`}
                    >
                      {user ? (
                        <Avatar name={user.name} hue={user.avatarHue} src={user.avatarUrl} size={32} />
                      ) : (
                        <UserRound className="h-5 w-5" />
                      )}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold ${
                      on ? "text-[#141414]" : "text-[#6f6a64] hover:text-[#141414]"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={on ? 2.4 : 2} />
                    <span className="hidden xl:inline">{item.label}</span>
                    {item.label === "Chats" && unread > 0 ? (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e85d04] px-1 text-[9px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="relative flex min-w-0 flex-1 items-center justify-end">
              {onShop ? <BagLink count={count} /> : null}
              <Link
                href="/messages?add=1"
                className="grid h-11 w-11 place-items-center text-[#141414]"
                title="Add someone"
                aria-label="Add someone"
              >
                <Plus className="h-6 w-6" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </header>

        {variant === "reel" || variant === "chat" ? (
          <div
            className={
              variant === "reel"
                ? "min-h-0 flex-1"
                : variant === "chat"
                  ? hideBars
                    ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                    : "flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(5.1rem+env(safe-area-inset-bottom))] lg:pb-0"
                  : ""
            }
          >
            {children}
          </div>
        ) : variant === "feed" || variant === "wide" ? (
          <div className={shell}>
            {variant === "feed" ? (
              <aside className="hidden lg:block">
                <nav className="sticky top-24 space-y-0.5">
                  {shortcuts.map((item) =>
                    item.href === "/create" ? (
                      <CreateSideButton key={item.label} icon={item.icon} />
                    ) : (
                      <SideLink key={item.label} href={item.href} icon={item.icon} label={item.label} />
                    ),
                  )}
                </nav>
              </aside>
            ) : null}
            <div className={variant === "feed" ? "min-w-0 bg-white lg:overflow-hidden lg:rounded-sm" : "min-w-0"}>
              {children}
            </div>
          </div>
        ) : (
          <div className={shell}>
            <aside className="hidden lg:block">
              <nav className="sticky top-20 space-y-1">
                <a href={profileHref} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-black/5">
                  <Avatar name={user?.name || ""} hue={user?.avatarHue || 0} src={user?.avatarUrl} size={36} />
                  <span className="font-semibold">{user?.name || "Profile"}</span>
                </a>
                {shortcuts.map((item) =>
                  item.href === "/create" ? (
                    <CreateSideButton key={item.label} icon={item.icon} />
                  ) : (
                    <SideLink key={item.label} href={item.href} icon={item.icon} label={item.label} />
                  ),
                )}
                <p className="px-2 pt-4 text-xs font-semibold tracking-wide text-fb-muted uppercase">Following</p>
                {people.slice(0, 5).map((p) => (
                  <PersonLink
                    key={p.id}
                    userId={p.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/5"
                  >
                    <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={32} userId={p.id} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-fb-muted">{p.headline}</span>
                    </span>
                  </PersonLink>
                ))}
                <div className="px-2 pt-6 text-[11px] leading-5 text-fb-muted">
                  <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> ·{" "}
                  <Link href="/contact">Contact</Link>
                </div>
              </nav>
            </aside>
            <div>{children}</div>
            <aside className="hidden lg:block">
              <div className="sticky top-20 space-y-4">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="px-1 text-[13px] font-semibold text-fb-muted">Following</p>
                  <ul className="mt-1">
                    {people.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <Link href={`/u/${p.id}`} className="flex w-full items-center gap-3 rounded-lg px-1 py-2 hover:bg-black/5">
                          <span className="relative">
                            <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={36} />
                            <Signal className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 text-[#e85d04]" strokeWidth={2.4} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="block truncate text-xs text-fb-muted">{p.headline}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="px-1 text-[13px] font-semibold text-fb-muted">Happening now</p>
                  <ul className="hide-scroll mt-2 max-h-72 space-y-2 overflow-y-auto">
                    {trends.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/p/${t.id}`}
                          className="block rounded-lg px-1 py-1 hover:bg-fb-hover"
                        >
                          <p className="text-[11px] font-semibold tracking-wide text-fb-muted uppercase">{t.kind}</p>
                          <p className="line-clamp-2 text-sm font-medium leading-5">{t.title}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        )}

        <nav
          className={`fixed inset-x-0 bottom-0 z-[200] border-t border-black/[0.08] bg-white pb-[max(0.7rem,env(safe-area-inset-bottom))] lg:hidden ${
            hideBars ? "hidden" : ""
          }`}
          aria-label="Mobile"
        >
          <div className="mx-auto flex h-[3.7rem] max-w-lg items-center justify-between px-1.5">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const on = active(item.href, item.label);
              if (item.label === "Profile") {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    title="Profile"
                    aria-label="Profile"
                    className="relative z-[210] flex h-12 flex-1 flex-col items-center justify-center touch-manipulation"
                  >
                    {user ? (
                      <span className={`rounded-full ${on ? "ring-2 ring-[#141414] ring-offset-2" : ""}`}>
                        <Avatar name={user.name} hue={user.avatarHue} src={user.avatarUrl} size={28} />
                      </span>
                    ) : (
                      <UserRound className="h-[22px] w-[22px]" />
                    )}
                  </a>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  title={item.label}
                  className={`relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation ${
                    on ? "text-[#141414]" : "text-[#6f6a64]"
                  }`}
                >
                  <Icon className="h-[22px] w-[22px] text-current" strokeWidth={on ? 2.45 : 2} />
                  <span className="text-[10px] font-semibold tracking-wide text-current">{item.label}</span>
                  {item.label === "Chats" && unread > 0 ? (
                    <span className="absolute top-1 right-[18%] grid h-4 min-w-4 place-items-center rounded-full bg-[#e85d04] px-1 text-[9px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                  <span className={`absolute inset-x-4 bottom-1 h-[2px] rounded-full ${on ? "bg-[#e85d04]" : "bg-transparent"}`} />
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </CreateFlowProvider>
  );
}

function headerTitle(path: string) {
  if (path.startsWith("/calls")) return "Calls";
  if (path.startsWith("/groups")) return "Groups";
  if (path.startsWith("/shop")) return "Shop";
  if (path.startsWith("/friends")) return "Following";
  if (path === "/" || path.startsWith("/messages")) return "Chats";
  if (path.startsWith("/u/") || path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/saved")) return "Saved";
  if (path.startsWith("/earn")) return "Wallet";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/create")) return "Create";
  return "Chats";
}

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle cx="12.5" cy="16" r="8" fill="#141414" />
      <circle cx="19.5" cy="16" r="8" fill="#e85d04" />
    </svg>
  );
}

function MobileAppHeader({
  onShop,
  cartCount,
  path,
}: {
  profileHref: string;
  user: { id: string; name: string; avatarHue: number; avatarUrl?: string } | null;
  onShop: boolean;
  cartCount: number;
  path: string;
}) {
  const title = headerTitle(path);
  const iconBtn =
    "relative grid h-8 w-8 place-items-center rounded-[8px] border border-[#0f172a] text-[#0f172a] active:scale-[0.94]";

  function addSomeone() {
    if (path.startsWith("/messages")) {
      window.dispatchEvent(new Event("connect-find-person"));
      return;
    }
    window.location.assign("/messages?add=1");
  }

  return (
    <div className="flex h-[68px] items-center justify-between overflow-visible border-b border-[#f1f5f9] bg-white px-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] [font-family:var(--font-header),ui-sans-serif,sans-serif] lg:hidden">
      <div className="flex items-center gap-2">
        <Link href="/messages" prefetch={false} className="grid place-items-center no-underline" aria-label="Chats">
          <BrandMark />
        </Link>
        {path.startsWith("/profile") || path.startsWith("/settings") || path.startsWith("/u/") ? (
          <span className="text-[1.15rem] font-extrabold tracking-[-0.03em] text-[#0f172a]">{title}</span>
        ) : (
          <Link href="/messages" prefetch={false} className="no-underline">
            <span className="text-[1.15rem] font-extrabold tracking-[-0.03em] text-[#0f172a]">{title}</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-visible">
        {onShop ? (
          <Link href="/shop/cart" className={iconBtn} aria-label="Bag">
            <ShoppingBag className="h-4 w-4" strokeWidth={2} />
            {cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#ff3b30] px-0.5 text-[8px] font-bold text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        <button type="button" onClick={addSomeone} className={iconBtn} aria-label="Add someone">
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function BagLink({ count }: { count: number }) {
  return (
    <Link
      href="/shop/cart"
      className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[#141414] shadow-sm"
      title="Bag"
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={2.1} />
      {count > 0 ? (
        <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#141414] px-1 text-[9px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function SideLink({ href, icon: Icon, label }: { href: string; icon: typeof Search; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-medium hover:bg-black/5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      {label}
    </Link>
  );
}
