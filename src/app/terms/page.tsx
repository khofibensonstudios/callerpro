import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Rules for using Connect Pro, publishing content, and earning from AdSense.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl space-y-4 text-[17px] leading-8">
        <h1 className="display text-5xl">Terms of use</h1>
        <p>Last updated: 15 August 2026.</p>
        <p>
          By creating an account or browsing public pages you agree to these terms. Connect Pro is
          a social network. You are responsible for the videos, photos, clips, and messages you
          publish.
        </p>
        <h2 className="display pt-2 text-3xl">Your content</h2>
        <p>
          You keep ownership of your work. You grant Connect Pro a license to host, display, and
          distribute it on the website and apps, and to place Google AdSense (and later other
          networks) next to it. You must have the rights to everything you upload.
        </p>
        <h2 className="display pt-2 text-3xl">Earnings</h2>
        <p>
          AdSense pays Connect Pro as the publisher. We share 70% of attributed ad revenue with
          the creator of the page that earned the impression. Balances under the payout threshold
          stay in the wallet. Invalid traffic, policy-violating content, and Google clawbacks can
          reduce or reverse earnings. Demo RPM on unpublished publisher IDs is not a guarantee of
          future income.
        </p>
        <h2 className="display pt-2 text-3xl">Prohibited use</h2>
        <p>
          No spam, no stolen work, no content that violates Google AdSense program policies, no
          attempts to click your own ads, and no scraping that harms the service.
        </p>
        <p>
          Questions: use the <a className="underline" href="/contact">contact page</a>.
        </p>
      </article>
    </SiteChrome>
  );
}
