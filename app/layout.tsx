import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/nav/TopNav";
import { MobileTabBar } from "@/components/nav/MobileTabBar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

function getSafeMetadataBase(): URL {
  const fallback = "https://reporting-tan.vercel.app";
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return new URL(fallback);

  // Allow values like "app.thevertical.pk" by assuming https.
  const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    return new URL(normalized);
  } catch {
    return new URL(fallback);
  }
}

export const metadata: Metadata = {
  title: "Dashboard",
  description: "No nonsense marketing and sales reporting",
  metadataBase: getSafeMetadataBase(),
  openGraph: {
    title: "Dashboard",
    description: "No nonsense marketing and sales reporting",
    type: "website",
    images: [{ url: "/og.jpeg", width: 1200, height: 630, alt: "Dashboard" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Dashboard",
    description: "No nonsense marketing and sales reporting",
    images: ["/og.jpeg"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="app-backdrop" aria-hidden="true" />
        <div className="app-content">
          <Providers>
            <TopNav />
            <div className="pt-[calc(14px+env(safe-area-inset-top))] pb-[calc(88px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
              {children}
            </div>
            <MobileTabBar />
          </Providers>
        </div>
      </body>
    </html>
  );
}


