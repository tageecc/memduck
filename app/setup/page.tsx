import { SetupWizard } from "@/components/setup-wizard";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function SetupPage() {
  const service = await getMemduckService();
  const setupState = service.getSetupState();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Setup</p>
          <h2>Configure memduck once, then start feeding it real memory.</h2>
          <p className="muted-copy">
            This first-run flow keeps the stack local and lightweight while
            still giving you a visual way to connect a provider and create the
            first card.
          </p>
        </section>
      }
    >
      <SetupWizard initialSetupState={setupState} />
    </SiteShell>
  );
}
