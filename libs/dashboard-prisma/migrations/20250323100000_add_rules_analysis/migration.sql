-- AlterTable
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "rules_analysis" TEXT;
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "rules_analysis_at" TIMESTAMP(3);
