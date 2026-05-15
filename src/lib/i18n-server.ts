import { cookies, headers } from "next/headers";

import {
  getDictionary,
  normalizeLocalePreference,
  normalizeThemePreference,
  resolveLocale,
} from "./i18n";

export const localeCookieName = "memduck_locale";
export const themeCookieName = "memduck_theme";

export async function getLocaleContext() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const preference = normalizeLocalePreference(
    cookieStore.get(localeCookieName)?.value,
  );
  const themePreference = normalizeThemePreference(
    cookieStore.get(themeCookieName)?.value,
  );
  const locale = resolveLocale(preference, headerStore.get("accept-language"));

  return {
    copy: getDictionary(locale),
    locale,
    preference,
    themePreference,
  };
}
