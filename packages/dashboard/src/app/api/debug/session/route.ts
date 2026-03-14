// Temporary debug endpoint — returns the current session object.
// Remove before going to production.

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "No session", session: null }, { status: 401 });
  }

  return NextResponse.json({
    hasApiKey: !!session.apiKey,
    apiKeyPrefix: session.apiKey ? session.apiKey.slice(0, 12) + "..." : null,
    hasLedgerId: !!session.ledgerId,
    ledgerId: session.ledgerId || null,
    userId: session.userId || null,
    needsTemplate: session.needsTemplate,
    needsOnboarding: session.needsOnboarding,
    user: {
      name: session.user?.name,
      email: session.user?.email,
      image: session.user?.image,
    },
  });
}
