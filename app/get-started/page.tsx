import Link from "next/link";

import { SiteShell } from "@/components/site-shell";

const steps = [
  {
    command: "pnpm install",
    detail: "Install the workspace dependencies once after cloning.",
    step: "Install dependencies",
  },
  {
    command: "pnpm memduck init",
    detail:
      "Create ~/.memduck/memduck.env plus the local runtime, SQLite, and asset paths.",
    step: "Initialize the local runtime",
  },
  {
    command: "pnpm memduck doctor",
    detail:
      "Check whether runtime paths, provider state, and channel health look sane before launching.",
    step: "Inspect the runtime",
  },
  {
    command: "pnpm memduck dev",
    detail:
      "Boot the local web runtime and open the visual setup flow in the browser.",
    step: "Start the app",
  },
  {
    command: "Open /setup",
    detail:
      "Save one real provider profile with explicit summarize, embedding, rerank, answer, and vision models.",
    step: "Connect a real provider",
  },
  {
    command: "Create one memory card",
    detail:
      "Paste a link, text, or image so the memory pipeline has real material to digest.",
    step: "Finish the first memory loop",
  },
];

const npmSteps = [
  {
    command: "npm install -g memduck@latest",
    detail: "Install the published CLI package from npm.",
    step: "Install the CLI",
  },
  {
    command: "memduck init",
    detail:
      "Create the explicit home config and runtime state under ~/.memduck.",
    step: "Initialize runtime",
  },
  {
    command: "memduck start",
    detail: "Run the packaged web runtime and background compiler worker.",
    step: "Start memduck",
  },
  {
    command: "memduck dashboard",
    detail: "Open the local browser UI and continue through visual setup.",
    step: "Open dashboard",
  },
];

const optionalChannels = [
  {
    command: "pnpm memduck dev --with-telegram",
    detail:
      "Run the web runtime and Telegram bot together in one local development command.",
    title: "Telegram bot",
  },
  {
    command: "pnpm extension:build",
    detail:
      "Build the browser extension, load it unpacked, and let the popup send a heartbeat back to memduck.",
    title: "Browser extension",
  },
];

export default function GetStartedPage() {
  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Get Started</p>
          <h2>The shortest path from clone to first memory card.</h2>
          <p className="muted-copy">
            memduck stays local and lightweight, but the first-run flow should
            still feel explicit: boot the runtime, connect one real provider,
            create one real memory card, then open channels as needed.
          </p>
        </section>
      }
    >
      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Install Path</p>
            <h2>Install memduck from npm</h2>
          </div>
          <p className="panel-copy">
            The target public experience mirrors an agent runtime: install one
            CLI, initialize local state explicitly, start the runtime, then open
            the browser setup flow.
          </p>
        </div>
        <div className="topic-list">
          {npmSteps.map((step, index) => (
            <div className="topic-card" key={step.step}>
              <strong>
                {index + 1}. {step.step}
              </strong>
              <span>{step.detail}</span>
              <code>{step.command}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Source Path</p>
            <h2>From clone to first memory in a few minutes</h2>
          </div>
          <p className="panel-copy">
            The web UI is the visible control surface, but the product still
            starts from a simple local runtime and one strict provider profile.
          </p>
        </div>
        <div className="topic-list">
          {steps.map((step, index) => (
            <div className="topic-card" key={step.step}>
              <strong>
                {index + 1}. {step.step}
              </strong>
              <span>{step.detail}</span>
              <code>{step.command}</code>
            </div>
          ))}
        </div>
        <div className="action-row">
          <Link className="primary-button" href="/setup">
            Open visual setup
          </Link>
          <Link className="secondary-button" href="/">
            Open workspace
          </Link>
        </div>
      </section>

      <section className="panel-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Why It Matters</p>
              <h2>What “working” should feel like</h2>
            </div>
          </div>
          <div className="topic-list">
            <div className="topic-card">
              <strong>Not just saved</strong>
              <span>
                The first card should already include a real summary, evidence,
                and topic link instead of acting like a bookmark.
              </span>
            </div>
            <div className="topic-card">
              <strong>Traceable by default</strong>
              <span>
                Every memory should still point back to the raw source and its
                underlying chunk-level grounding.
              </span>
            </div>
            <div className="topic-card">
              <strong>Ready for questions</strong>
              <span>
                After the first memory lands, Ask and Review should already feel
                grounded in your own saved material.
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Optional Channels</p>
              <h2>Bring in the surfaces you actually use</h2>
            </div>
          </div>
          <div className="topic-list">
            {optionalChannels.map((channel) => (
              <div className="topic-card" key={channel.title}>
                <strong>{channel.title}</strong>
                <span>{channel.detail}</span>
                <code>{channel.command}</code>
              </div>
            ))}
          </div>
          <div className="action-row">
            <Link className="secondary-button" href="/channels">
              Open channel center
            </Link>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
