import { LanguageSettings } from "@/components/language-settings";
import { SiteShell } from "@/components/site-shell";
import { ThemeSettings } from "@/components/theme-settings";
import { getLocaleContext } from "@/lib/i18n-server";

export default async function SetupPage() {
  const { copy, preference, themePreference } = await getLocaleContext();
  const { settings } = copy;

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
      </div>
    </SiteShell>
  );
}
