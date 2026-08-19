import { NextResponse } from "next/server";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
  const pub = client.replace(/^ca-/, "");
  const lines = [
    "# ads.txt for Connect Pro — Google AdSense",
    "# Mediapartners-Google and AdsBot-Google must be allowed in robots.txt (they are).",
    pub
      ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0`
      : "# Add NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXX after AdSense approval, then redeploy.",
  ];
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
