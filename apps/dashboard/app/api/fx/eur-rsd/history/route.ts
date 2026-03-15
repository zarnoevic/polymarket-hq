import { NextResponse } from "next/server";

const DAYS = 90;
const SAMPLE_STEP = 3; // one point every 3 days to limit API calls

export async function GET() {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ history: [] });
  }

  const history: { date: string; rate: number }[] = [];
  const today = new Date();

  for (let i = 0; i < DAYS; i += SAMPLE_STEP) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/history/EUR/${year}/${month}/${day}`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const rate = data?.conversion_rates?.RSD;
      if (typeof rate === "number") {
        history.push({ date: dateStr, rate: Math.round(rate * 100) / 100 });
      }
    } catch {
      // skip this date
    }
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ history });
}
