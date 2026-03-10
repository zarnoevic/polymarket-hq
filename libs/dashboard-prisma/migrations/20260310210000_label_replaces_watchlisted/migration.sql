-- Migrate watchlisted to label
ALTER TABLE "screener_events" ADD COLUMN "label" TEXT;

UPDATE "screener_events" SET "label" = 'opportunity' WHERE "watchlisted" = true;

-- Drop old column and index
DROP INDEX IF EXISTS "screener_events_watchlisted_idx";
ALTER TABLE "screener_events" DROP COLUMN "watchlisted";

-- Create index on label
CREATE INDEX "screener_events_label_idx" ON "screener_events"("label");
