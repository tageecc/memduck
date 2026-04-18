import { AskStudio } from "@/components/ask-studio";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function AskPage() {
  const service = await getMemduckService();
  const topics = service.listTopics();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Ask</p>
          <h2>
            Interrogate your own content graph instead of the whole internet.
          </h2>
          <p className="muted-copy">
            Answers are grounded in what you actually saved, with source-linked
            citations and topic-aware filters.
          </p>
        </section>
      }
    >
      <AskStudio topics={topics} />
    </SiteShell>
  );
}
