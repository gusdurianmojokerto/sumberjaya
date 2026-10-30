const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.aiucajvmyrqvfubyhksx:Sumberjaya123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
const migrations = [
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_times JSONB DEFAULT '{}'",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_prices JSONB DEFAULT '{}'",
  "CREATE TABLE IF NOT EXISTS modules (jilid INT PRIMARY KEY, cover_url TEXT)",
  "ALTER TABLE modules ENABLE ROW LEVEL SECURITY",
  "DROP POLICY IF EXISTS \"Allow all on modules\" ON modules",
  "CREATE POLICY \"Allow all on modules\" ON modules FOR ALL USING (true) WITH CHECK (true)",
  `CREATE TABLE IF NOT EXISTS progress_reports (
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
  )`,
  "ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY",
  "DROP POLICY IF EXISTS \"Allow all on progress_reports\" ON progress_reports",
  "CREATE POLICY \"Allow all on progress_reports\" ON progress_reports FOR ALL USING (true) WITH CHECK (true)"
];
(async () => {
  try {
    for (const q of migrations) await pool.query(q);
    console.log('Migration OK');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
