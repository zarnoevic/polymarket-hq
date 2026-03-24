import { prisma } from "@polymarket-hq/dashboard-prisma";

function portfolioSnapshotDelegate() {
  return (
    prisma as unknown as {
      portfolioPriceSnapshot?: {
        create: (args: unknown) => Promise<unknown>;
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    }
  ).portfolioPriceSnapshot;
}

export type PortfolioSnapshotPoint = {
  capturedAt: string;
  totalValue: number;
  cash: number;
  positionsValue: number;
  positionValues: Record<string, number>;
};

export function buildPositionValueMap(
  positions: Array<{ asset: string; currentValue: number }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of positions) {
    out[p.asset] = p.currentValue;
  }
  return out;
}

export async function recordPortfolioSnapshot(params: {
  wallet: string;
  cash: number;
  positionsValue: number;
  totalValue: number;
  positionValues: Record<string, number>;
}): Promise<void> {
  const delegate = portfolioSnapshotDelegate();
  if (!delegate?.create) {
    console.warn(
      "[portfolio] Prisma client has no portfolioPriceSnapshot model — run `pnpm exec prisma generate` (schema: libs/dashboard-prisma/schema.prisma) and restart the dev server."
    );
    return;
  }
  try {
    await delegate.create({
      data: {
        wallet: params.wallet.toLowerCase(),
        cash: params.cash,
        positionsValue: params.positionsValue,
        totalValue: params.totalValue,
        positionValues: params.positionValues,
      },
    });
  } catch (e) {
    console.error("Portfolio snapshot failed:", e);
  }
}

export async function fetchPortfolioHistory(
  wallet: string,
  limit = 400
): Promise<PortfolioSnapshotPoint[]> {
  const delegate = portfolioSnapshotDelegate();
  if (!delegate?.findMany) {
    return [];
  }
  const rows = (await delegate.findMany({
    where: { wallet: wallet.toLowerCase() },
    orderBy: { capturedAt: "asc" },
    take: limit,
    select: {
      capturedAt: true,
      totalValue: true,
      cash: true,
      positionsValue: true,
      positionValues: true,
    },
  })) as Array<{
    capturedAt: Date;
    totalValue: number;
    cash: number;
    positionsValue: number;
    positionValues: unknown;
  }>;
  return rows.map((r) => ({
    capturedAt: r.capturedAt.toISOString(),
    totalValue: r.totalValue,
    cash: r.cash,
    positionsValue: r.positionsValue,
    positionValues:
      r.positionValues != null && typeof r.positionValues === "object" && !Array.isArray(r.positionValues)
        ? (r.positionValues as Record<string, number>)
        : {},
  }));
}
