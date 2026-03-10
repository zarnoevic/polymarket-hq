-- AlterTable
ALTER TABLE "screener_events" RENAME CONSTRAINT "ad_screener_events_pkey" TO "screener_events_pkey";

-- RenameIndex
ALTER INDEX "ad_screener_events_external_id_key" RENAME TO "screener_events_external_id_key";

-- RenameIndex
ALTER INDEX "ad_screener_events_synced_at_idx" RENAME TO "screener_events_synced_at_idx";

-- RenameIndex
ALTER INDEX "ad_screener_events_volume_idx" RENAME TO "screener_events_volume_idx";
