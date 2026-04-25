import { NextResponse } from "next/server";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET() {
  const service = await getMemduckService();

  try {
    return NextResponse.json(service.getReviewSections());
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Compiled review buckets are unavailable.",
      },
      { status: 409 },
    );
  }
}
