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
import type { Dictionary, ThemePreference } from "@/lib/i18n";
import { themePreferences } from "@/lib/i18n";

export function ThemeSettings({
  copy,
  initialPreference,
}: {
  copy: Dictionary["settings"];
  initialPreference: ThemePreference;
}) {
  const [preference, setPreference] =
    useState<ThemePreference>(initialPreference);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const labels: Record<ThemePreference, string> = {
    clean: copy.themeClean,
    dark: copy.themeDark,
    warm: copy.themeWarm,
  };

  function save() {
    setPending(true);
    setMessage(null);

    startTransition(() => {
      void fetch("/api/settings/ui", {
        body: JSON.stringify({ themePreference: preference }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await readErrorMessage(response, "设置保存失败。"));
          }

          setMessage(copy.themeSaved);
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
            <FieldLabel>{copy.theme}</FieldLabel>
            <Select
              value={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {themePreferences.map((themePreference) => (
                    <SelectItem key={themePreference} value={themePreference}>
                      {labels[themePreference]}
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
          {copy.saveSettings}
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
