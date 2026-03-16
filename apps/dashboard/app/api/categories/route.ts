import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";

function normalizeWallet(wallet?: string): string {
  const w = (wallet ?? "").trim().toLowerCase();
  return w || "default";
}

/** Position categories from DB - scoped by wallet */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = normalizeWallet(searchParams.get("wallet") ?? undefined);

    const categories = await prisma.positionCategory.findMany({
      where: { wallet },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const assignments = await prisma.positionCategoryAssignment.findMany({
      where: { wallet },
      include: { category: true },
    });

    const positionToCategory: Record<string, string> = {};
    for (const a of assignments) {
      positionToCategory[a.asset] = a.categoryId;
    }

    return NextResponse.json({
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      positionToCategory,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Save position categories - replaces all for the wallet */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const wallet = normalizeWallet(body.wallet);
    const categories: { id: string; name: string }[] = Array.isArray(body.categories)
      ? body.categories
      : [];
    const positionToCategory: Record<string, string> =
      body.positionToCategory && typeof body.positionToCategory === "object"
        ? body.positionToCategory
        : {};

    // Delete existing assignments for this wallet
    await prisma.positionCategoryAssignment.deleteMany({ where: { wallet } });

    // Delete categories not in the new list (orphaned)
    const newCatIds = new Set(categories.map((c) => c.id));
    await prisma.positionCategory.deleteMany({
      where: {
        wallet,
        id: { notIn: Array.from(newCatIds) },
      },
    });

    // Upsert categories and create assignments in a transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < categories.length; i++) {
        const c = categories[i];
        if (!c?.id || typeof c.name !== "string") continue;
        await tx.positionCategory.upsert({
          where: { wallet_id: { wallet, id: c.id } },
          create: {
            wallet,
            id: c.id,
            name: c.name,
            sortOrder: i,
          },
          update: { name: c.name, sortOrder: i },
        });
      }

      for (const [asset, categoryId] of Object.entries(positionToCategory)) {
        if (!asset || !categoryId) continue;
        if (categoryId === "__uncategorized__") continue;
        if (!newCatIds.has(categoryId)) continue;
        await tx.positionCategoryAssignment.upsert({
          where: { wallet_asset: { wallet, asset } },
          create: { wallet, asset, categoryId },
          update: { categoryId },
        });
      }
    });

    const saved = await prisma.positionCategory.findMany({
      where: { wallet },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const assignments = await prisma.positionCategoryAssignment.findMany({
      where: { wallet },
    });
    const outMap: Record<string, string> = {};
    for (const a of assignments) {
      outMap[a.asset] = a.categoryId;
    }

    return NextResponse.json({
      categories: saved.map((c) => ({ id: c.id, name: c.name })),
      positionToCategory: outMap,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
