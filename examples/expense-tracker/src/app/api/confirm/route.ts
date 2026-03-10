import { ledge } from "@/lib/ledge";
import { NextResponse } from "next/server";
import type { ConfirmAction } from "@ledge/sdk";

export async function POST(req: Request) {
  try {
    const { batchId, actions } = (await req.json()) as {
      batchId: string;
      actions: ConfirmAction[];
    };

    if (!batchId || !actions?.length) {
      return NextResponse.json(
        { error: "batchId and actions are required" },
        { status: 400 },
      );
    }

    const result = await ledge.imports.confirmMatches(batchId, actions);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
