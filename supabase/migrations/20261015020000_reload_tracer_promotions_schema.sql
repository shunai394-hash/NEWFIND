-- Reload PostgREST after the TRACER promotion ledger is created.
notify pgrst, 'reload schema';
