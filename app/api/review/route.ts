import { NextResponse } from "next/server";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET() {
  const service = await getMemduckService();
  const compiled = service.getCompiledReviewBuckets();

  if (!compiled) {
    return NextResponse.json(
      {
        error:
          "Compiled review buckets are unavailable. Run the background worker first.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(compiled);
}
