import Link from "next/link";

import { SiteShell } from "@/components/site-shell";
import { getLocaleContext } from "@/lib/i18n-server";

export default async function GetStartedPage() {
  const { copy } = await getLocaleContext();
  const npmSteps = [
    {
      command: "npm install -g memduck@latest",
      title: copy.getStarted.steps.npmInstall,
    },
    {
      command: "memduck",
      title: copy.getStarted.steps.npmRun,
    },
    {
      command: "/setup",
      title: copy.getStarted.steps.provider,
    },
  ];
  const sourceSteps = [
    {
      command: "pnpm install",
      title: copy.getStarted.steps.sourceInstall,
    },
    {
      command: "pnpm memduck dev",
      title: copy.getStarted.steps.sourceRun,
    },
  ];

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">{copy.getStarted.introEyebrow}</p>
          <h2>{copy.getStarted.introTitle}</h2>
          <p className="muted-copy">{copy.getStarted.introBody}</p>
        </section>
      }
    >
      <section className="panel-grid">
        <section className="panel panel-emphasis">
          <div className="panel-header">
            <div>
              <p className="eyebrow">npm</p>
              <h2>{copy.getStarted.npmTitle}</h2>
            </div>
            <p className="panel-copy">{copy.getStarted.npmBody}</p>
          </div>
          <div className="topic-list">
            {npmSteps.map((step, index) => (
              <div className="topic-card" key={step.command}>
                <strong>
                  {index + 1}. {step.title}
                </strong>
                <code>{step.command}</code>
              </div>
            ))}
          </div>
          <div className="action-row">
            <Link className="primary-button" href="/setup">
              {copy.getStarted.openSetup}
            </Link>
            <Link className="secondary-button" href="/">
              {copy.getStarted.openWorkspace}
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">source</p>
              <h2>{copy.getStarted.sourceTitle}</h2>
            </div>
            <p className="panel-copy">{copy.getStarted.sourceBody}</p>
          </div>
          <div className="topic-list">
            {sourceSteps.map((step, index) => (
              <div className="topic-card" key={step.command}>
                <strong>
                  {index + 1}. {step.title}
                </strong>
                <code>{step.command}</code>
              </div>
            ))}
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
