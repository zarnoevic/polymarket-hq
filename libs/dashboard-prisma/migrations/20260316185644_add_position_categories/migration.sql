-- CreateTable
CREATE TABLE "position_categories" (
    "wallet" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_categories_pkey" PRIMARY KEY ("wallet","id")
);

-- CreateTable
CREATE TABLE "position_category_assignments" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_category_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_categories_wallet_idx" ON "position_categories"("wallet");

-- CreateIndex
CREATE INDEX "position_category_assignments_wallet_idx" ON "position_category_assignments"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "position_category_assignments_wallet_asset_key" ON "position_category_assignments"("wallet", "asset");

-- AddForeignKey
ALTER TABLE "position_category_assignments" ADD CONSTRAINT "position_category_assignments_wallet_category_id_fkey" FOREIGN KEY ("wallet", "category_id") REFERENCES "position_categories"("wallet", "id") ON DELETE CASCADE ON UPDATE CASCADE;
