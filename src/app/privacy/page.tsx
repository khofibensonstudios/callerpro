import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Connect Pro collects, uses, and shares information, including Google AdSense cookies and advertising data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl space-y-4 text-[17px] leading-8">
        <h1 className="display text-5xl">Privacy policy</h1>
        <p>Last updated: 15 August 2026.</p>
        <p>
          Connect Pro (“we”, “us”) runs a social network at this domain. This policy explains what
          we collect and how Google advertising works on the site. If you do not agree, do not use
          the service.
        </p>
        <h2 className="display pt-2 text-3xl">Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account data: name, email, password hash, skills, and the formats you publish.</li>
          <li>Content you post: videos, photos, clips, and messages you send.</li>
          <li>Usage: views on posts, device type, and approximate location derived from IP.</li>
          <li>Cookies needed to keep you signed in.</li>
        </ul>
        <h2 className="display pt-2 text-3xl">Google AdSense</h2>
        <p>
          We use Google AdSense to show advertisements on public pages. Google, as a third-party
          vendor, uses cookies to serve ads based on a user’s prior visits to this website and
          other websites. Google’s use of advertising cookies enables it and its partners to serve
          ads based on visits to this site and/or other sites on the Internet.
        </p>
        <p>
          Users may opt out of personalized advertising by visiting{" "}
          <a className="underline" href="https://www.google.com/settings/ads">
            Google Ads Settings
          </a>
          . Alternatively, you can opt out of a third-party vendor’s use of cookies for
          personalized advertising by visiting{" "}
          <a className="underline" href="https://www.aboutads.info/choices/">
            www.aboutads.info
          </a>
          .
        </p>
        <p>
          Third-party vendors, including Google, may show ads on this site. We implement ads in
          server-rendered HTML so Google’s ad crawler (Mediapartners-Google) and AdsBot-Google can
          access the same pages as readers.
        </p>
        <h2 className="display pt-2 text-3xl">How we use data</h2>
        <p>
          We use account and content data to operate the network, show your work, calculate AdSense
          revenue share, prevent abuse, and communicate about the service. We do not sell email
          lists.
        </p>
        <h2 className="display pt-2 text-3xl">Retention and requests</h2>
        <p>
          You may request a copy or deletion of your account through the{" "}
          <a className="underline" href="/contact">
            contact page
          </a>
          . Public posts may remain indexed by search engines until those engines recrawl.
        </p>
      </article>
    </SiteChrome>
  );
}
