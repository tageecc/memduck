import { BotIcon, DatabaseIcon, PlugIcon } from "lucide-react";
import Link from "next/link";

import { LanguageSettings } from "@/components/language-settings";
import { SiteShell } from "@/components/site-shell";
import { ThemeSettings } from "@/components/theme-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLocaleContext } from "@/lib/i18n-server";

export default async function SetupPage() {
  const { copy, preference, themePreference } = await getLocaleContext();
  const { settings } = copy;
  const shortcuts = [
    {
      description: settings.modelsDescription,
      href: "/models",
      icon: BotIcon,
      label: settings.openModels,
      title: settings.modelsTitle,
    },
    {
      description: settings.channelsDescription,
      href: "/channels",
      icon: PlugIcon,
      label: settings.openChannels,
      title: settings.channelsTitle,
    },
    {
      description: settings.exportDescription,
      href: "/api/export?format=json",
      icon: DatabaseIcon,
      label: settings.exportData,
      title: settings.exportTitle,
    },
  ];

  return (
    <SiteShell>
      <div className="flex w-full max-w-3xl flex-col gap-6 p-4">
        <header className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{settings.eyebrow}</p>
          <h1 className="text-2xl font-medium">{settings.title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {settings.theme} · {settings.language}
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{settings.language}</h2>
          <LanguageSettings copy={settings} initialPreference={preference} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{settings.theme}</h2>
          <ThemeSettings copy={settings} initialPreference={themePreference} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">{settings.workspaceTitle}</h2>
            <p className="text-muted-foreground text-sm">
              {settings.workspaceDescription}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;

              return (
                <Card className="flex flex-col" key={shortcut.href}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-4 text-muted-foreground" />
                      {shortcut.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 pt-0">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {shortcut.description}
                    </p>
                  </CardContent>
                  <CardFooter className="border-border/50 border-t bg-muted/10">
                    <Button asChild className="w-full" size="sm">
                      <Link href={shortcut.href}>{shortcut.label}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
