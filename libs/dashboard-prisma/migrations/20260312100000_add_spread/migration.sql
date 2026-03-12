-- AlterTable
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "yes_spread" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "no_spread" DOUBLE PRECISION;
