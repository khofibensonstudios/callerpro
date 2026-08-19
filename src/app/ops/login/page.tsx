import { redirect } from "next/navigation";
import { OpsLoginForm } from "@/components/ops/OpsLoginForm";
import { opsSession } from "@/lib/ops-auth";
import { opsHref } from "@/lib/ops-path";

export const dynamic = "force-dynamic";

export default async function OpsLoginPage() {
  if (await opsSession()) redirect(opsHref());

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <main className="w-full max-w-sm py-16">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--ops-muted)] uppercase">Control center</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Access</h1>
        <OpsLoginForm />
      </main>
    </div>
  );
}
