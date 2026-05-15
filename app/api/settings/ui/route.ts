import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { localeCookieName, themeCookieName } from "@/lib/i18n-server";
import { uiSettingsSchema } from "@/lib/memduck/contracts";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = uiSettingsSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid UI settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const response = NextResponse.json(parsed.data);
  if (parsed.data.localePreference) {
    response.cookies.set(localeCookieName, parsed.data.localePreference, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }
  if (parsed.data.themePreference) {
    response.cookies.set(themeCookieName, parsed.data.themePreference, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}
