import Link from "next/link";

import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      command: "/models",
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
    <SiteShell>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 shadow-sm ring-1 ring-black/[0.03]">
          <CardHeader className="border-border/60 border-b">
            <CardTitle className="font-serif text-xl">
              {copy.getStarted.npmTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {npmSteps.map((step, index) => (
              <Card key={step.command} size="sm">
                <CardHeader>
                  <CardTitle>
                    {index + 1}. {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code>{step.command}</code>
                </CardContent>
              </Card>
            ))}
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/models">{copy.getStarted.openSetup}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/ask">{copy.getStarted.openWorkspace}</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-border/70 shadow-sm ring-1 ring-black/[0.03]">
          <CardHeader className="border-border/60 border-b">
            <CardTitle className="font-serif text-xl">
              {copy.getStarted.sourceTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sourceSteps.map((step, index) => (
              <Card key={step.command} size="sm">
                <CardHeader>
                  <CardTitle>
                    {index + 1}. {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code>{step.command}</code>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </section>
    </SiteShell>
  );
}
