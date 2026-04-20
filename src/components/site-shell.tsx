import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/topics", label: "Topics" },
  { href: "/ask", label: "Ask" },
  { href: "/review", label: "Review" },
  { href: "/channels", label: "Channels" },
  { href: "/setup", label: "Setup" },
];

export function SiteShell({
  children,
  intro,
}: PropsWithChildren<{ intro?: ReactNode }>) {
  return (
    <div className="shell">
      <aside className="side-rail">
        <div className="brand-block">
          <p className="eyebrow">memduck</p>
          <h1>A self-hosted personal memory engine</h1>
          <p className="brand-copy">
            Digest links, long posts, screenshots, and fragments into memory
            cards you can ask, revisit, and deepen over time.
          </p>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span>{item.label}</span>
              <span className="nav-arrow">↗</span>
            </Link>
          ))}
        </nav>

        <div className="rail-note">
          <p className="eyebrow">Simple Dev Shape</p>
          <p>
            Single Next.js app. SQLite. Local files. Extension + Telegram
            script.
          </p>
        </div>
      </aside>

      <main className="main-panel">
        {intro}
        {children}
      </main>
    </div>
  );
}
