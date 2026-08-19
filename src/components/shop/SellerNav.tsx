"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/shop/manage", label: "Overview" },
  { href: "/shop/manage/products", label: "Products" },
  { href: "/shop/manage/orders", label: "Orders" },
];

export function SellerNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-5 overflow-x-auto border-b border-black/[0.08] text-[12px] font-semibold tracking-[0.14em] uppercase">
      {links.map((l) => {
        const on = l.href === "/shop/manage" ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 pb-3 ${on ? "border-b-2 border-[#141414] text-[#141414]" : "border-b-2 border-transparent text-[#6f6a64]"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
