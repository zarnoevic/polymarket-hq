import { NextResponse } from "next/server";

const CLOB_BASE = "https://clob.polymarket.com";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("token_id");
  if (!tokenId?.trim()) {
    return NextResponse.json({ error: "Missing token_id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `CLOB returned ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
