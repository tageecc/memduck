"use client";

import { startTransition, useState } from "react";

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
            throw new Error(payload.error ?? "Unable to save UI settings.");
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
    <section className="panel panel-emphasis">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{copy.language}</p>
          <h2>{copy.title}</h2>
        </div>
        <p className="panel-copy">{copy.body}</p>
      </div>
      <div className="choice-row">
        {localePreferences.map((localePreference) => (
          <button
            className={
              preference === localePreference ? "chip chip-active" : "chip"
            }
            key={localePreference}
            onClick={() => setPreference(localePreference)}
            type="button"
          >
            {labels[localePreference]}
          </button>
        ))}
      </div>
      <div className="action-row">
        <button
          className="primary-button"
          disabled={pending}
          onClick={save}
          type="button"
        >
          {copy.save}
        </button>
      </div>
      {message ? <p className="action-result">{message}</p> : null}
    </section>
  );
}
