-- Add day_times column for per-day schedule
ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_times JSONB DEFAULT '{}';

-- Add day_prices column for per-day price
ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_prices JSONB DEFAULT '{}';

-- Create modules table for cover image URLs stored in Supabase Storage
CREATE TABLE IF NOT EXISTS modules (
  jilid INT PRIMARY KEY,
  cover_url TEXT
);

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on modules" ON modules FOR ALL USING (true) WITH CHECK (true);
