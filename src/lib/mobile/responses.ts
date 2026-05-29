import { NextResponse } from "next/server";

export function mobileUnauthorized() {
  return NextResponse.json(
    { error: "Mobile authentication is required." },
    { status: 401 },
  );
}

export function mobileBadRequest(error: string, issues?: unknown) {
  return NextResponse.json({ error, issues }, { status: 400 });
}
