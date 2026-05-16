import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { PropsWithChildren } from "react";

import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getLocaleContext } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  description:
    "A self-hosted personal memory engine for digesting links, text, and screenshots into reusable memory cards.",
  title: "memduck",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const { locale, themePreference } = await getLocaleContext();

  return (
    <html
      className={cn("font-sans antialiased", geist.variable)}
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
