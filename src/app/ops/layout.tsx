import { cookies } from "next/headers";
import type { Metadata } from "next";
import { OPS_THEME_COOKIE } from "@/lib/ops-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control center",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

export default async function OpsRootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(OPS_THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return <div className={`ops-desk min-h-full${theme === "dark" ? " ops-dark" : ""}`}>{children}</div>;
}
