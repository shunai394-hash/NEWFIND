-- Reload PostgREST after the TRACER promotion ledger is created or reconciled.
-- This migration is intentionally idempotent and is re-applied when the receiver
-- reports PGRST205 (table missing from schema cache) after the table probe succeeds.
notify pgrst, 'reload schema';
