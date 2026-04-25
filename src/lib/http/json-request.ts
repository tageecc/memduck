import { NextResponse } from "next/server";

export async function readJsonRequest(request: Request): Promise<
  | {
      body: unknown;
      ok: true;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  try {
    return {
      body: await request.json(),
      ok: true,
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      ),
    };
  }
}
