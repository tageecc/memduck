import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getLocaleContext } from "@/lib/i18n-server";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "A self-hosted personal memory engine for digesting links, text, and screenshots into reusable memory cards.",
  title: "memduck",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const { locale, themePreference } = await getLocaleContext();

  return (
    <html
      className="font-sans antialiased"
      data-theme={themePreference}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <TooltipProvider>
          {children}
          <CommandPalette />
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
