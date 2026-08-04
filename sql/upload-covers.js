// ============================================================
// SCRIPT: Unggah foto sampul modul (img/covers/jilid1-4.jpg)
// ke Supabase Storage (bucket publik "covers") lalu simpan
// URL publiknya ke tabel "modules" (jilid, cover_url).
//
// CARA PAKAI:
//   1. Ambil SERVICE_ROLE key dari Supabase Dashboard
//      (Settings > API > service_role key). JANGAN sebarkan.
//   2. Set environment variable lalu jalankan:
//        $env:SERVICE_ROLE_KEY="sb_secret_..."
//        node sql/upload-covers.js
//   Atau edit variabel SERVICE_ROLE_KEY di bawah.
// ============================================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://aiucajvmyrqvfubyhksx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || 'PASTE_SERVICE_ROLE_KEY_DI_SINI';

const BUCKET = 'covers';
const COVERS_DIR = path.join(__dirname, '..', 'img', 'covers');
const BASE_STORAGE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

async function api(pathname, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  if (SERVICE_ROLE_KEY === 'PASTE_SERVICE_ROLE_KEY_DI_SINI') {
    throw new Error('Isi SERVICE_ROLE_KEY terlebih dahulu (ubah di file atau set env SERVICE_ROLE_KEY).');
  }

  const entries = [
    { file: 'jilid1.jpg', jilid: 1 },
    { file: 'jilid2.jpg', jilid: 2 },
    { file: 'jilid3.jpg', jilid: 3 },
    { file: 'jilid4.jpg', jilid: 4 }
  ];

  console.log('1) Membuat bucket publik:', BUCKET);
  try {
    await api('/storage/v1/bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
    });
    console.log('   bucket dibuat / sudah ada');
  } catch (e) {
    console.log('   (bucket mungkin sudah ada:', e.message, ')');
  }

  console.log('2) Mengunggah foto sampul...');
  for (const { file, jilid } of entries) {
    const p = path.join(COVERS_DIR, file);
    if (!fs.existsSync(p)) { console.log(`   lewati ${file} (tidak ada)`); continue; }

    try {
      await api(`/storage/v1/object/${BUCKET}/${file}`, { method: 'DELETE' });
    } catch (e) { /* file belum ada, abaikan */ }

    const buf = fs.readFileSync(p);
    const bytes = new Uint8Array(buf);
    await api(`/storage/v1/object/${BUCKET}/${file}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': bytes.length
      },
      body: bytes
    });
    const coverUrl = `${BASE_STORAGE}/${file}`;
    console.log(`   ${file} -> ${coverUrl}`);

    await api('/rest/v1/modules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ jilid, cover_url: coverUrl })
    });
  }

  console.log('3) Selesai. Cek tabel modules di Supabase.');
}

main().then(() => process.exit(0)).catch(e => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});