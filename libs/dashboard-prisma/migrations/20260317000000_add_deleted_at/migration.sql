-- Add soft delete column to screener_events
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Index for filtering non-deleted events
CREATE INDEX IF NOT EXISTS "screener_events_deleted_at_idx" ON "screener_events"("deleted_at");
