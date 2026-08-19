import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { siteUrl, APP_NAME } from "@/lib/constants";
import { sessionUser } from "@/lib/auth";

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const header = Plus_Jakarta_Sans({
  variable: "--font-header",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const adsense = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: `${APP_NAME} is a chat and calling app for private conversations, group chats, and video calls.`,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    url: siteUrl(),
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  other: {
    "format-detection": "telephone=no, email=no, address=no, date=no",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await sessionUser();
  return (
    <html lang="en" className={`${body.variable} ${header.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("cp_theme")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-fb-bg text-fb-text" suppressHydrationWarning>
        {adsense ? (
          <Script
            id="adsense"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
        <Providers user={user}>{children}</Providers>
      </body>
    </html>
  );
}
