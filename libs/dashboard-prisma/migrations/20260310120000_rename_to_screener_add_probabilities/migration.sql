-- Rename table ad_screener_events to screener_events and add new columns
ALTER TABLE "ad_screener_events" RENAME TO "screener_events";

ALTER TABLE "screener_events" ADD COLUMN "probability_yes" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN "probability_no" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN "appraised_yes" DOUBLE PRECISION;
ALTER TABLE "screener_events" ADD COLUMN "appraised_no" DOUBLE PRECISION;
