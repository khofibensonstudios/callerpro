import { redirect } from "next/navigation";
import { OpsShell } from "@/components/ops/OpsShell";
import { opsSession } from "@/lib/ops-auth";
import { opsHeaderState } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";

export const dynamic = "force-dynamic";

export default async function OpsConsoleLayout({ children }: { children: React.ReactNode }) {
  if (!(await opsSession())) redirect(opsHref("/login"));
  const header = await opsHeaderState();
  return <OpsShell header={header}>{children}</OpsShell>;
}
