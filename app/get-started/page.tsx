import { SiteShell } from "@/components/site-shell";

const steps = [
  "Run pnpm install.",
  "Start the app with pnpm dev.",
  "Set TELEGRAM_BOT_TOKEN only if you want the Telegram entrypoint.",
  "Build and load the extension with pnpm extension:build.",
  "Send your first link, text, or screenshot and generate your first memory card.",
];

export default function GetStartedPage() {
  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Get Started</p>
          <h2>The shortest path from clone to first memory card.</h2>
          <p className="muted-copy">
            This dev-first architecture keeps the stack light: one app, SQLite,
            local files, plus optional Telegram and extension entrypoints.
          </p>
        </section>
      }
    >
      <section className="panel">
        <div className="topic-list">
          {steps.map((step, index) => (
            <div className="topic-card" key={step}>
              <strong>
                {index + 1}. {step}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
