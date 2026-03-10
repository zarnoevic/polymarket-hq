-- AlterTable
ALTER TABLE "screener_events" ADD COLUMN "last_appraised" TIMESTAMP(3);
ALTER TABLE "screener_events" ADD COLUMN "yev" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN "nev" DOUBLE PRECISION;
