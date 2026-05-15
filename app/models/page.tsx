import { ProviderCenter } from "@/components/provider-center";
import { SetupWizard } from "@/components/setup-wizard";
import { SiteShell } from "@/components/site-shell";
import { getLocaleContext } from "@/lib/i18n-server";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function ModelsPage() {
  const { copy } = await getLocaleContext();
  const service = await getMemduckService();
  const setupState = service.getSetupState();

  if (setupState.needsOnboarding) {
    return (
      <main className="min-h-svh bg-background">
        <SetupWizard
          copy={copy.setup}
          initialSetupState={setupState}
          variant="onboarding"
        />
      </main>
    );
  }

  return (
    <SiteShell>
      <ProviderCenter copy={copy.setup} />
    </SiteShell>
  );
}
