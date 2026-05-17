"use client";

import { startTransition, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readErrorMessage } from "@/lib/http/response";
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
            throw new Error(await readErrorMessage(response, "设置保存失败。"));
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
    <Card>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{copy.language}</FieldLabel>
            <Select
              value={preference}
              onValueChange={(value) =>
                setPreference(value as LocalePreference)
              }
            >
              <SelectTrigger className="w-full max-w-md">
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
      </CardContent>
      <CardFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
        <Button disabled={pending} onClick={save} type="button">
          {copy.save}
        </Button>
        {message ? (
          <Alert className="flex-1 sm:max-w-md" variant="default">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardFooter>
    </Card>
  );
}
