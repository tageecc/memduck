import { cookies, headers } from "next/headers";

import {
  getDictionary,
  normalizeLocalePreference,
  resolveLocale,
} from "./i18n";

export const localeCookieName = "memduck_locale";

export async function getLocaleContext() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const preference = normalizeLocalePreference(
    cookieStore.get(localeCookieName)?.value,
  );
  const locale = resolveLocale(preference, headerStore.get("accept-language"));

  return {
    copy: getDictionary(locale),
    locale,
    preference,
  };
}
