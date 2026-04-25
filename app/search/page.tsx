import { redirect } from "next/navigation";

import { SearchStudio } from "@/components/search-studio";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function SearchPage() {
  const service = await getMemduckService();

  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Search</p>
          <h2>Search your saved memory graph directly.</h2>
          <p className="muted-copy">
            Use retrieval without committing to a conversation first, then jump
            into Ask from the cards that actually matter.
          </p>
        </section>
      }
    >
      <SearchStudio topics={service.listTopics()} />
    </SiteShell>
  );
}
