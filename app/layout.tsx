import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { getLocaleContext } from "@/lib/i18n-server";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "A self-hosted personal memory engine for digesting links, text, and screenshots into reusable memory cards.",
  title: "memduck",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const { locale } = await getLocaleContext();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
