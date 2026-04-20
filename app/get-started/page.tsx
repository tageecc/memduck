import { SiteShell } from "@/components/site-shell";

const steps = [
  "Run pnpm install.",
  "Run pnpm memduck init.",
  "Run pnpm memduck doctor.",
  "Start the local stack with pnpm memduck dev and open /setup.",
  "Connect one provider, or choose Mock / Demo for local exploration.",
  "Create the first real memory card from the setup flow.",
  "Use pnpm memduck dev --with-telegram if you want the Telegram entrypoint in the same local stack.",
  "Build and load the extension with pnpm extension:build.",
];

export default function GetStartedPage() {
  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Get Started</p>
          <h2>The shortest path from clone to first memory card.</h2>
          <p className="muted-copy">
            memduck keeps the stack lightweight, but the setup path now mirrors
            the actual product shape: one CLI, one web runtime, one background
            compiler, plus optional Telegram and extension entrypoints.
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
