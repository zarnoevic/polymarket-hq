-- CreateTable
CREATE TABLE "ad_screener_events" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "icon" TEXT,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "end_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_screener_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_screener_events_external_id_key" ON "ad_screener_events"("external_id");

-- CreateIndex
CREATE INDEX "ad_screener_events_synced_at_idx" ON "ad_screener_events"("synced_at");

-- CreateIndex
CREATE INDEX "ad_screener_events_volume_idx" ON "ad_screener_events"("volume");
