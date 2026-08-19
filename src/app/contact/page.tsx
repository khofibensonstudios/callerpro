import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Contact Connect Pro",
  description: "Contact the Connect Pro publisher team about AdSense, privacy, or the network.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl space-y-4 text-[17px] leading-8">
        <h1 className="display text-5xl">Contact</h1>
        <p>
          This page exists so people — and Google — can reach the publisher of this site. We read
          every message about privacy, copyright, and AdSense.
        </p>
        <p>
          Email:{" "}
          <a className="underline" href="mailto:publisher@connectpro.app">
            publisher@connectpro.app
          </a>
        </p>
        <p>
          For account deletion or a copy of your data, put “privacy request” in the subject line
          and include the email on the account.
        </p>
        <p>
          For AdSense policy questions, include the URL of the public post. Do not ask us to click
          ads.
        </p>
        <h2 className="display pt-4 text-3xl">Postal</h2>
        <address className="not-italic">
          Connect Pro Publisher Desk
          <br />
          Online social network
          <br />
          Use email for the fastest response.
        </address>
      </article>
    </SiteChrome>
  );
}
