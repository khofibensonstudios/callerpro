import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "How Google AdSense works on Connect Pro",
  description:
    "AdSense is the business. Pages are server-rendered HTML. Googlebot and Mediapartners-Google are allowed. ads.txt, privacy, and sitemaps are public.",
  alternates: { canonical: "/how-adsense-works" },
};

export default function AdSensePage() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl space-y-4 text-[17px] leading-8">
        <h1 className="display text-5xl">How AdSense works here</h1>
        <p>
          The business of Connect Pro is Google AdSense on public social posts. If Google cannot
          crawl a page, AdSense cannot review it. Previous sites failed because the content lived
          only in JavaScript after login. This site does the opposite.
        </p>
        <h2 className="display pt-2 text-3xl">What Google must be able to see</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Full article text and video pages as HTML — not empty shells filled in by the browser.
          </li>
          <li>
            <a className="underline" href="/robots.txt">
              /robots.txt
            </a>{" "}
            allowing Googlebot, Mediapartners-Google, AdsBot-Google, and AdsBot-Google-Mobile.
          </li>
          <li>
            <a className="underline" href="/sitemap.xml">
              /sitemap.xml
            </a>{" "}
            listing every public post and profile.
          </li>
          <li>
            <a className="underline" href="/ads.txt">
              /ads.txt
            </a>{" "}
            with your publisher ID after approval.
          </li>
          <li>
            <a className="underline" href="/privacy">
              Privacy policy
            </a>{" "}
            that names AdSense and cookie opt-out, plus{" "}
            <a className="underline" href="/contact">
              contact
            </a>{" "}
            and{" "}
            <a className="underline" href="/about">
              about
            </a>
            .
          </li>
        </ul>
        <h2 className="display pt-2 text-3xl">Localhost cannot be crawled</h2>
        <p>
          Google’s crawlers cannot see your PC. http://127.0.0.1:3000 is only for building. For
          AdSense review you must deploy this same app on a public https:// domain, set
          NEXT_PUBLIC_SITE_URL to that domain, paste your ca-pub- ID, and request indexing in
          Search Console. Then apply to AdSense against that live site.
        </p>
        <h2 className="display pt-2 text-3xl">Money split</h2>
        <p>
          AdSense pays the publisher account. Connect Pro attributes impressions to the post that
          was on screen and credits 70% to that creator’s wallet. Clicking your own ads is
          forbidden and will wipe earnings.
        </p>
      </article>
    </SiteChrome>
  );
}
