const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.aiucajvmyrqvfubyhksx:Sumberjaya123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('Connected to database');

    const sql = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf-8');
    await client.query(sql);
    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setup().then(() => process.exit(0)).catch(() => process.exit(1));
