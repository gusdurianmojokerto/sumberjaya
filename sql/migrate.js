const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.aiucajvmyrqvfubyhksx:Sumberjaya123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
pool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS day_times JSONB DEFAULT '{}'")
  .then(() => { console.log('Migration OK'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
