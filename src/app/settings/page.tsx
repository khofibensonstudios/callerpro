"use client";

import { Suspense } from "react";
import { SiteChrome } from "@/components/SiteChrome";
import { SettingsScreen } from "@/components/SettingsScreen";

export default function SettingsPage() {
  return (
    <SiteChrome variant="wide">
      <Suspense
        fallback={
          <div className="px-5 pt-4">
            <p className="text-[17px] font-bold tracking-tight">Settings</p>
            <p className="mt-4 text-sm text-fb-muted">Loading</p>
          </div>
        }
      >
        <SettingsScreen />
      </Suspense>
    </SiteChrome>
  );
}
