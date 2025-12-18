import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/nav/TopNav";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Blank slate Next.js + HeroUI project"
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
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}


