-- Add note_updated_at column to track when note was last saved
ALTER TABLE "screener_events" ADD COLUMN IF NOT EXISTS "note_updated_at" TIMESTAMP(3);
