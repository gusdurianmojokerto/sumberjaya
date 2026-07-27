-- Add day_times column for per-day schedule
ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_times JSONB DEFAULT '{}';
