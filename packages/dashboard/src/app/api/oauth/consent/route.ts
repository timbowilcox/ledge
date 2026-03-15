// ---------------------------------------------------------------------------
// POST /api/oauth/consent — proxies consent approval to the Kounta API.
//
// The consent page calls this after the user clicks Allow/Deny.
// We forward the request to the API's POST /oauth/consent endpoint
// with admin secret (preferred) or the user's API key as auth.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    console.error("[oauth/consent] No session or user");
    return NextResponse.json(
      { error: { message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const apiUrl = process.env.KOUNTA_API_URL ?? "https://api.kounta.ai";
  const adminSecret = process.env.KOUNTA_ADMIN_SECRET;
  // Fall back to the user's API key if admin secret is not configured
  const apiKey = (session as unknown as { apiKey: string }).apiKey;
  const authToken = adminSecret || apiKey;

  if (!authToken) {
    console.error("[oauth/consent] No KOUNTA_ADMIN_SECRET and no session apiKey available");
    return NextResponse.json(
      { error: { message: "Server configuration error: no auth token available" } },
      { status: 500 }
    );
  }

  const userId = (session as unknown as { userId: string }).userId;
  const ledgerId = (session as unknown as { ledgerId: string }).ledgerId;

  const payload = {
    ...body,
    user_id: userId,
    ledger_id: ledgerId,
  };

  console.log("[oauth/consent] Proxying to API:", {
    url: `${apiUrl}/oauth/consent`,
    authType: adminSecret ? "admin_secret" : "api_key",
    userId,
    ledgerId,
    clientId: body.client_id,
    approved: body.approved,
  });

  try {
    const res = await fetch(`${apiUrl}/oauth/consent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log("[oauth/consent] API response:", {
      status: res.status,
      data,
    });

    if (!res.ok) {
      console.error("[oauth/consent] API returned error:", res.status, data);
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[oauth/consent] Failed to communicate with API:", err);
    return NextResponse.json(
      { error: { message: "Failed to communicate with API" } },
      { status: 502 }
    );
  }
}
