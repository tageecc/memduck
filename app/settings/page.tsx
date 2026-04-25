import { LanguageSettings } from "@/components/language-settings";
import { SiteShell } from "@/components/site-shell";
import { getLocaleContext } from "@/lib/i18n-server";

export default async function SettingsPage() {
  const { copy, preference } = await getLocaleContext();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">{copy.settings.eyebrow}</p>
          <h2>{copy.settings.title}</h2>
          <p className="muted-copy">{copy.settings.body}</p>
        </section>
      }
    >
      <LanguageSettings copy={copy.settings} initialPreference={preference} />
    </SiteShell>
  );
}
