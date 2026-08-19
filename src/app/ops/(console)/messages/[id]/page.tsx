import { redirect } from "next/navigation";
import { opsHref } from "@/lib/ops-path";

export const dynamic = "force-dynamic";

export default function OpsMessageThreadPage() {
  redirect(opsHref());
}
