import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  // In production (Vercel), trigger the scan via OpenClaw system event
  // which Ace picks up and runs scan-local.mjs on the local machine.
  // For now, this endpoint signals that a scan was requested.
  try {
    return NextResponse.json({
      success: true,
      message: "Scan request received. Refreshing from database.",
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
