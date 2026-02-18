import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/nav/TopNav";
import { MobileTabBar } from "@/components/nav/MobileTabBar";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import { isMarketingTeamProfile } from "@/components/tasks/taskModel";

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

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  let marketingUserId: string | null = null;
  try {
    const supabase = await createServerDbClient();
    const repo = createDashboardRepo(supabase);
    const profile = await repo.getCurrentProfile();
    if (profile && isMarketingTeamProfile(profile)) marketingUserId = profile.id;
  } catch {
    marketingUserId = null;
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <Script
          id="client-error-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  function toString(value) {
    try { return String(value); } catch { return ""; }
  }
  function normalizeError(err) {
    if (err && typeof err === "object") {
      var name = "name" in err ? toString(err.name) : "";
      var message = "message" in err ? toString(err.message) : "Unknown error";
      var stack = "stack" in err ? toString(err.stack) : "";
      return { name: name || undefined, message: message, stack: stack || undefined };
    }
    return { message: toString(err) || "Unknown error" };
  }
  function send(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/client-error", body);
        return;
      }
      fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body: body });
    } catch (e) {}
  }
  function show(payload) {
    try {
      if (document.getElementById("client-error-banner")) return;
      var el = document.createElement("div");
      el.id = "client-error-banner";
      el.style.position = "fixed";
      el.style.left = "16px";
      el.style.right = "16px";
      el.style.bottom = "16px";
      el.style.zIndex = "9999";
      el.style.background = "rgba(127,29,29,0.92)";
      el.style.border = "1px solid rgba(239,68,68,0.25)";
      el.style.color = "rgba(254,226,226,0.95)";
      el.style.padding = "12px 14px";
      el.style.borderRadius = "16px";
      el.style.fontSize = "12px";
      el.style.lineHeight = "1.4";
      el.innerHTML =
        "<div style=\\"font-weight:600;\\">Something went wrong</div>" +
        "<div style=\\"opacity:0.8; margin-top:4px;\\">We captured a client error. Reload or logout to recover.</div>" +
        "<div style=\\"opacity:0.7; margin-top:6px; white-space:pre-wrap; max-height:120px; overflow:auto;\\">" +
        (payload.name ? payload.name + ": " : "") + payload.message + "</div>" +
        "<div style=\\"margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;\\">" +
        "<button id=\\"client-error-reload\\" style=\\"background:#ef4444;color:white;border:none;border-radius:10px;padding:6px 10px;cursor:pointer;\\">Reload</button>" +
        "<button id=\\"client-error-logout\\" style=\\"background:rgba(255,255,255,0.1);color:white;border:none;border-radius:10px;padding:6px 10px;cursor:pointer;\\">Logout</button>" +
        "<button id=\\"client-error-dismiss\\" style=\\"background:transparent;color:white;border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:6px 10px;cursor:pointer;\\">Dismiss</button>" +
        "</div>";
      document.body.appendChild(el);
      document.getElementById("client-error-reload")?.addEventListener("click", function () { window.location.reload(); });
      document.getElementById("client-error-logout")?.addEventListener("click", function () { window.location.assign("/logout"); });
      document.getElementById("client-error-dismiss")?.addEventListener("click", function () { el.remove(); });
    } catch (e) {}
  }
  function report(err) {
    var normalized = normalizeError(err);
    var payload = {
      name: normalized.name,
      message: normalized.message || "Unknown error",
      stack: normalized.stack,
      href: window.location.href,
      at: new Date().toISOString()
    };
    send(payload);
    show(payload);
  }
  window.addEventListener("error", function (event) { report(event && (event.error || event.message)); });
  window.addEventListener("unhandledrejection", function (event) { report(event && event.reason); });
})();
`
          }}
        />
        <div className="app-backdrop" aria-hidden="true" />
        <div className="app-content">
          <Providers marketingUserId={marketingUserId}>
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


