const API_KEY = process.env.AI_API_KEY || 'sk-xhpBVY7MCNZZ9KgVykmDzzVvOCJJVCsRMxNCS3Iq5reJIahe';
const API_URL = 'https://api.hcnsec.cn/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 55000;

function buildPrompt({ jilid, topic, title }) {
  return `Buatlah modul pembelajaran Bahasa Inggris untuk siswa SD kelas 1-3.

Jilid: ${jilid}
Tema/Topik: ${topic}
Judul Modul: ${title}

Buat dalam BAHASA INDONESIA dengan format berikut:

1. **Materi Pokok**: Penjelasan singkat tentang topik ${topic} dalam bahasa Inggris yang mudah dipahami anak SD. Sertakan contoh kalimat (5-7 kalimat) dengan terjemahan Bahasa Indonesia.

2. **Kosakata Baru (New Vocabulary)**: 8-12 kosakata terkait ${topic} lengkap dengan arti Bahasa Indonesia.

3. **Bacaan Sederhana (Reading)**: Sebuah cerita pendek (4-6 kalimat) dalam bahasa Inggris yang menggunakan kosakata ${topic}. Sertakan terjemahan bebas dalam Bahasa Indonesia.

4. **Latihan Soal**: Buat 5-7 soal latihan dengan variasi:
   - 2-3 soal mencocokkan (matching)
   - 2-3 soal melengkapi kalimat (fill in the blanks)
   - 1-2 soal menjawab pertanyaan berdasarkan bacaan

5. **Kunci Jawaban**: Berikan kunci jawaban untuk semua soal di atas.

Tampilkan dalam format yang rapi dengan judul modul di bagian atas. Gunakan bahasa Indonesia untuk instruksi soal.`;
}

async function generatePaperContent({ jilid, topic, title }) {
  const prompt = buildPrompt({ jilid, topic, title });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'DeepSeek-V4-Pro',
        messages: [
          { role: 'system', content: 'Anda adalah guru Bahasa Inggris SD yang berpengalaman. Buat materi pembelajaran yang menarik, mudah dipahami, dan sesuai untuk anak SD kelas 1-3. Gunakan bahasa Indonesia untuk instruksi.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }
    const detail = data.error ? JSON.stringify(data.error) : JSON.stringify(data);
    throw new Error('Gagal mendapatkan respons dari AI: ' + detail);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Waktu generate habis, coba lagi.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generatePaperContent };
