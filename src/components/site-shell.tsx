import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";

import { getLocaleContext } from "@/lib/i18n-server";

const NAV_ITEMS = [
  { href: "/", icon: "H", key: "home" },
  { href: "/inbox", icon: "I", key: "inbox" },
  { href: "/topics", icon: "T", key: "topics" },
  { href: "/search", icon: "S", key: "search" },
  { href: "/ask", icon: "A", key: "ask" },
  { href: "/review", icon: "R", key: "review" },
  { href: "/channels", icon: "C", key: "channels" },
  { href: "/setup", icon: "O", key: "setup" },
  { href: "/settings", icon: "P", key: "settings" },
] as const;

export async function SiteShell({
  children,
  intro,
}: PropsWithChildren<{ intro?: ReactNode }>) {
  const { copy } = await getLocaleContext();

  return (
    <div className="shell">
      <aside className="side-rail">
        <div className="brand-block">
          <p className="eyebrow">memduck</p>
          <h1>{copy.shell.brandTitle}</h1>
          <p className="brand-copy">{copy.shell.brandCopy}</p>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span className="nav-icon">{item.icon}</span>
              <span>{copy.shell.nav[item.key]}</span>
            </Link>
          ))}
        </nav>

        <div className="rail-note">
          <p className="eyebrow">{copy.shell.command}</p>
          <code>memduck</code>
        </div>
      </aside>

      <main className="main-panel">
        {intro}
        {children}
      </main>
    </div>
  );
}
