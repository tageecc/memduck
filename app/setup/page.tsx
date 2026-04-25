import { SetupWizard } from "@/components/setup-wizard";
import { SiteShell } from "@/components/site-shell";
import { getLocaleContext } from "@/lib/i18n-server";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function SetupPage() {
  const { copy } = await getLocaleContext();
  const service = await getMemduckService();
  const setupState = service.getSetupState();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">{copy.setup.introEyebrow}</p>
          <h2>{copy.setup.introTitle}</h2>
          <p className="muted-copy">{copy.setup.introBody}</p>
        </section>
      }
    >
      <SetupWizard copy={copy.setup} initialSetupState={setupState} />
    </SiteShell>
  );
}
