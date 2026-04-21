import { redirect } from "next/navigation";

import { ChannelCenter } from "@/components/channel-center";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function ChannelsPage() {
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Channels</p>
          <h2>Keep every entry point visible and configurable.</h2>
          <p className="muted-copy">
            Web, extension, and Telegram all feed the same ingestion contract.
            This page keeps the runtime knobs, install steps, and health checks
            in one place so channels never feel hidden.
          </p>
        </section>
      }
    >
      <ChannelCenter />
    </SiteShell>
  );
}
