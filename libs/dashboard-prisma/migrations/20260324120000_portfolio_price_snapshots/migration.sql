-- CreateTable
CREATE TABLE "portfolio_price_snapshots" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cash" DOUBLE PRECISION NOT NULL,
    "positions_value" DOUBLE PRECISION NOT NULL,
    "total_value" DOUBLE PRECISION NOT NULL,
    "position_values" JSONB NOT NULL,

    CONSTRAINT "portfolio_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_price_snapshots_wallet_captured_at_idx" ON "portfolio_price_snapshots"("wallet", "captured_at");
