import { redirect } from "next/navigation";

import { ChannelCenter } from "@/components/channel-center";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function ChannelsPage() {
  const service = await getMemduckService();

  if (service.getSetupState().needsOnboarding) {
    redirect("/models");
  }

  return (
    <SiteShell>
      <ChannelCenter />
    </SiteShell>
  );
}
