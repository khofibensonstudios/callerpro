import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "About Connect Pro",
  description:
    "Connect Pro is a chat and calling app for private conversations, group chats, and video calls.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <SiteChrome>
      <article className="prose-like mx-auto max-w-2xl space-y-4 text-[17px] leading-8">
        <h1 className="display text-5xl">About Connect Pro</h1>
        <p>
          Connect Pro is built for conversations. Chat privately, start a video or audio call, and
          keep groups in one place.
        </p>
        <p>
          Public pages stay as HTML so Google can crawl them. Money on this network comes first from
          Google AdSense on those public pages. Connect Pro is the publisher. Creators receive 70% of
          the ad revenue Google attributes to their posts.
        </p>
        <h2 className="display pt-4 text-3xl">Contact</h2>
        <p>
          Publisher questions, privacy requests, and AdSense issues go through the{" "}
          <a className="underline" href="/contact">
            contact page
          </a>
          . Legal terms live on <a className="underline" href="/terms">Terms</a> and{" "}
          <a className="underline" href="/privacy">Privacy</a>.
        </p>
      </article>
    </SiteChrome>
  );
}
