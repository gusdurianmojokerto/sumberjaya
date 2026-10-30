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

-- Progress reports (laporan progres anak) stored in Supabase
CREATE TABLE IF NOT EXISTS progress_reports (
  key TEXT PRIMARY KEY,
  child TEXT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  sessions_total TEXT DEFAULT '',
  sessions_hadir TEXT DEFAULT '',
  understanding TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  parent_notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ,
  materials JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on progress_reports" ON progress_reports;
CREATE POLICY "Allow all on progress_reports" ON progress_reports FOR ALL USING (true) WITH CHECK (true);
