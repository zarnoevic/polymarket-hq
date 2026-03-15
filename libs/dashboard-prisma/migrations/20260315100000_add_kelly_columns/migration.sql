-- AlterTable
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "trader_appraised_yes" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "kelly_c" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "kelly_criterion" DOUBLE PRECISION;
