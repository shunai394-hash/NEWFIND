-- Ensure PostgREST sees the newly created TRACER promotion ledger immediately.
notify pgrst, 'reload schema';
