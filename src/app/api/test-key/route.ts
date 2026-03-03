import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;

  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });

  const body = await r.text();
  return NextResponse.json({ status: r.status, body });
}