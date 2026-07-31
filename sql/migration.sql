-- Add day_times column for per-day schedule
ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_times JSONB DEFAULT '{}';

-- Add day_prices column for per-day price
ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_prices JSONB DEFAULT '{}';
