import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    R2_ENDPOINT: process.env.R2_ENDPOINT ? `${process.env.R2_ENDPOINT.slice(0, 30)}...` : "NOT SET",
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? `${process.env.R2_ACCESS_KEY_ID.slice(0, 8)}...` : "NOT SET",
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? `${process.env.R2_SECRET_ACCESS_KEY.slice(0, 8)}...` : "NOT SET",
    R2_CANONICAL_BUCKET: process.env.R2_CANONICAL_BUCKET || "NOT SET",
    R2_CANONICAL_PREFIX: process.env.R2_CANONICAL_PREFIX || "NOT SET",
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? `${process.env.R2_ACCOUNT_ID.slice(0, 8)}...` : "NOT SET",
  });
}
