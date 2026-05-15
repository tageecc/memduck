"use client";

import { startTransition, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary, LocalePreference } from "@/lib/i18n";
import { localePreferences } from "@/lib/i18n";

export function LanguageSettings({
  copy,
  initialPreference,
}: {
  copy: Dictionary["settings"];
  initialPreference: LocalePreference;
}) {
  const [preference, setPreference] =
    useState<LocalePreference>(initialPreference);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const labels: Record<LocalePreference, string> = {
    auto: copy.auto,
    en: copy.english,
    ja: copy.japanese,
    zh: copy.zh,
  };

  function save() {
    setPending(true);
    setMessage(null);

    startTransition(() => {
      void fetch("/api/settings/ui", {
        body: JSON.stringify({ localePreference: preference }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json()) as { error?: string };
            throw new Error(payload.error ?? "设置保存失败。");
          }

          setMessage(copy.saved);
          window.location.reload();
        })
        .catch((error: Error) => {
          setMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm ring-1 ring-black/[0.03]">
      <FieldGroup>
        <Field>
          <FieldLabel className="text-foreground">{copy.language}</FieldLabel>
          <Select
            value={preference}
            onValueChange={(value) => setPreference(value as LocalePreference)}
          >
            <SelectTrigger className="mt-2 h-10 w-full max-w-md border-border/80 bg-background shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {localePreferences.map((localePreference) => (
                  <SelectItem key={localePreference} value={localePreference}>
                    {labels[localePreference]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button disabled={pending} onClick={save} type="button">
          {copy.save}
        </Button>
        {message ? (
          <Alert className="flex-1 sm:max-w-md" variant="default">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
