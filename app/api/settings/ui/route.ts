import { NextResponse } from "next/server";

import { localeCookieName } from "@/lib/i18n-server";
import { uiSettingsSchema } from "@/lib/memduck/contracts";

export async function POST(request: Request) {
  const parsed = uiSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid UI settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const response = NextResponse.json(parsed.data);
  response.cookies.set(localeCookieName, parsed.data.localePreference, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
