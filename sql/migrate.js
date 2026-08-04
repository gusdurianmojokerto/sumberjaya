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
  "CREATE POLICY IF NOT EXISTS \"Allow all on modules\" ON modules FOR ALL USING (true) WITH CHECK (true)"
];
Promise.all(migrations.map(q => pool.query(q)))
  .then(() => { console.log('Migration OK'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
