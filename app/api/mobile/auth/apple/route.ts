import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { mobileAppleAuthSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { verifyAppleIdentityToken } from "@/lib/mobile/apple";
import { mobileBadRequest } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = mobileAppleAuthSchema.safeParse(json.body);
  if (!parsed.success) {
    return mobileBadRequest(
      "Invalid mobile Apple auth request.",
      parsed.error.flatten(),
    );
  }

  try {
    const apple = await verifyAppleIdentityToken(parsed.data.identityToken);
    const service = await getMemduckService();
    const session = service.redeemMobileInviteWithApple({
      appleEmail: apple.email,
      appleSubject: apple.subject,
      inviteCode: parsed.data.inviteCode,
    });

    return NextResponse.json(session);
  } catch (error) {
    return mobileBadRequest(
      error instanceof Error ? error.message : "Mobile sign-in failed.",
    );
  }
}
