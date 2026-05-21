import { redirect } from "next/navigation";

import { ChannelCenter } from "@/components/channel-center";
import { SiteShell } from "@/components/site-shell";
import { getLocaleContext } from "@/lib/i18n-server";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function ChannelsPage() {
  const { locale } = await getLocaleContext();
  const service = await getMemduckService();

  if (service.getSetupState().needsOnboarding) {
    redirect("/models");
  }

  return (
    <SiteShell>
      <ChannelCenter locale={locale} />
    </SiteShell>
  );
}
