export interface VerifiedAppleIdentity {
  email?: string;
  subject: string;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<VerifiedAppleIdentity> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Apple identity token.");
  }

  const payload = JSON.parse(
    Buffer.from(parts[1] ?? "", "base64url").toString("utf8"),
  ) as { email?: string; sub?: string };

  if (!payload.sub) {
    throw new Error("Apple identity token is missing a subject.");
  }

  return {
    email: payload.email,
    subject: payload.sub,
  };
}
