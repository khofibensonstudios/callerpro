import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { OpsAudit, OpsReport, OpsWithdrawal } from "@/lib/ops-types";
import type { OpsSettings } from "@/lib/ops-settings";

export type OpsMetaFile = {
  reports: OpsReport[];
  audit: OpsAudit[];
  settings?: OpsSettings;
  withdrawals?: OpsWithdrawal[];
};

const META = path.join(process.cwd(), "data", "ops-meta.json");
let metaCache: OpsMetaFile | null = null;

export function emptyOpsMeta(): OpsMetaFile {
  return { reports: [], audit: [], withdrawals: [] };
}

export async function loadOpsMeta(): Promise<OpsMetaFile> {
  if (metaCache) return metaCache;
  try {
    const raw = JSON.parse(await readFile(META, "utf8")) as OpsMetaFile;
    metaCache = {
      reports: raw.reports ?? [],
      audit: raw.audit ?? [],
      settings: raw.settings,
      withdrawals: raw.withdrawals ?? [],
    };
  } catch {
    metaCache = emptyOpsMeta();
  }
  return metaCache;
}

export function saveOpsMeta() {
  if (!metaCache) return;
  const snapshot = JSON.stringify(metaCache, null, 2);
  void mkdir(path.dirname(META), { recursive: true }).then(() => writeFile(META, snapshot));
}

export function opsMetaCache() {
  return metaCache;
}

export function setOpsMetaCache(next: OpsMetaFile) {
  metaCache = next;
}
