import { LanguageSettings } from "@/components/language-settings";
import { SiteShell } from "@/components/site-shell";
import { ThemeSettings } from "@/components/theme-settings";
import { getLocaleContext } from "@/lib/i18n-server";

export default async function SetupPage() {
  const { copy, preference, themePreference } = await getLocaleContext();
  const { settings } = copy;

  return (
    <SiteShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="space-y-1 border-border/60 border-b pb-6">
          <p className="font-mono text-muted-foreground text-[0.65rem] uppercase tracking-[0.2em]">
            {settings.eyebrow}
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
            {settings.title}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {settings.theme} · {settings.language}
          </p>
        </header>

        <section className="space-y-4 border-border/60 border-b pb-10">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            {settings.language}
          </h2>
          <LanguageSettings copy={settings} initialPreference={preference} />
        </section>

        <section className="space-y-4 pb-4">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            {settings.theme}
          </h2>
          <ThemeSettings copy={settings} initialPreference={themePreference} />
        </section>
      </div>
    </SiteShell>
  );
}
