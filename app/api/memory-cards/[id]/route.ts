import { NextResponse } from "next/server";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const service = await getMemduckService();
  const card = service.getMemoryCard(id);

  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(card);
}
