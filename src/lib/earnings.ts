import { AD_IMPRESSION_RPM_USD, CREATOR_SHARE, VIEW_RPM_USD } from "./constants";

export function usdToMicros(usd: number) {
  return Math.round(usd * 1_000_000);
}

export function microsToUsd(micros: number) {
  return micros / 1_000_000;
}

export function formatUsd(micros: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(microsToUsd(micros));
}

export function viewPayoutMicros() {
  return usdToMicros((VIEW_RPM_USD / 1000) * CREATOR_SHARE);
}

export function adPayoutMicros() {
  return usdToMicros((AD_IMPRESSION_RPM_USD / 1000) * CREATOR_SHARE);
}
