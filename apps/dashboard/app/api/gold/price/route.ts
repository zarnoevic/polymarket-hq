import { NextResponse } from "next/server";

const TROY_OZ_TO_GRAM = 31.1035;

/**
 * Fetches gold price per gram in EUR.
 * Uses MetalpriceAPI if GOLD_API_KEY is set; otherwise returns a fallback for development.
 * Sign up at https://metalpriceapi.com for a free API key.
 *
 * Tries (1) latest endpoint with base=XAU, then (2) convert endpoint for 1 oz → EUR.
 */
export async function GET() {
  const apiKey = process.env.GOLD_API_KEY;
  const cacheOpt = { next: { revalidate: 3600 } };

  if (apiKey) {
    try {
      // Method 1: latest?base=XAU&currencies=EUR → rates.EUR = EUR per 1 troy oz
      const latestRes = await fetch(
        `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=XAU&currencies=EUR`,
        cacheOpt
      );
      if (latestRes.ok) {
        const data = await latestRes.json();
        const eurPerOz = data?.rates?.EUR ?? data?.rates?.XAUEUR;
        if (typeof eurPerOz === "number" && eurPerOz > 0) {
          const eurPerGram = eurPerOz / TROY_OZ_TO_GRAM;
          return NextResponse.json({ eurPerGram: Math.round(eurPerGram * 100) / 100 });
        }
      }

      // Method 2: convert 1 XAU to EUR
      const convertRes = await fetch(
        `https://api.metalpriceapi.com/v1/convert?api_key=${apiKey}&from=XAU&to=EUR&amount=1`,
        cacheOpt
      );
      if (convertRes.ok) {
        const data = await convertRes.json();
        const eurPerOz = data?.result;
        if (typeof eurPerOz === "number" && eurPerOz > 0) {
          const eurPerGram = eurPerOz / TROY_OZ_TO_GRAM;
          return NextResponse.json({ eurPerGram: Math.round(eurPerGram * 100) / 100 });
        }
      }

      throw new Error("Invalid or missing rate");
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to fetch" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ eurPerGram: 82 });
}
