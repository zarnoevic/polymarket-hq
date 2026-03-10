-- Rename opportunity to vetted
UPDATE "screener_events" SET "label" = 'vetted' WHERE "label" = 'opportunity';
