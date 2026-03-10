-- AlterTable
ALTER TABLE "screener_events" ADD COLUMN "watchlisted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "screener_events_watchlisted_idx" ON "screener_events"("watchlisted");
