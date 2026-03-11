-- AlterTable
ALTER TABLE "screener_events" ADD COLUMN "last_think_appraised_at" TIMESTAMP(3);
ALTER TABLE "screener_events" ADD COLUMN "last_think_appraisal_duration_seconds" INTEGER;
ALTER TABLE "screener_events" ADD COLUMN "last_reappraised_at" TIMESTAMP(3);
ALTER TABLE "screener_events" ADD COLUMN "last_reappraisal_duration_seconds" INTEGER;
