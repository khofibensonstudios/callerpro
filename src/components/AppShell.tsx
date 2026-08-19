"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Feed" },
  { href: "/discover", label: "People" },
  { href: "/create", label: "Post" },
  { href: "/messages", label: "Chat" },
  { href: "/earn", label: "Earn" },
  { href: "/profile", label: "You" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 pt-5 md:pb-10">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="display text-2xl tracking-tight">
          Connect <span className="text-clay">Pro</span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full bg-ink px-2 py-1 text-sm text-cream md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 ${path === l.href ? "bg-lime text-ink" : "hover:bg-white/10"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="text-sm text-ink/60 hover:text-ink">
          Sign out
        </button>
      </header>
      <main className="flex-1 pt-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-ink/10 bg-cream/95 px-2 py-3 text-xs font-medium md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "text-clay" : "text-ink/55"}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
