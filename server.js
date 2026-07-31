const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// AI Paper Generation
app.post('/api/generate-paper', async (req, res) => {
  const { jilid, topic, title } = req.body;
  const prompt = `Buatlah modul pembelajaran Bahasa Inggris untuk siswa SD kelas 1-3.

Jilid: ${jilid}
Tema/Topik: ${topic}
Judul Modul: ${title}

Buat dalam BAHASA INDONESIA dengan format berikut:

1. **Materi Pokok**: Penjelasan singkat tentang topik ${topic} dalam bahasa Inggris yang mudah dipahami anak SD. Sertakan contoh kalimat (5-7 kalimat) dengan terjemahan Bahasa Indonesia.

2. **Kosakata Baru (New Vocabulary)**: 10-15 kosakata terkait ${topic} lengkap dengan arti Bahasa Indonesia.

3. **Bacaan Sederhana (Reading)**: Sebuah cerita pendek (5-8 kalimat) dalam bahasa Inggris yang menggunakan kosakata ${topic}. Sertakan terjemahan bebas dalam Bahasa Indonesia.

4. **Latihan Soal**: Buat 8-10 soal latihan dengan variasi:
   - 2-3 soal mencocokkan (matching)
   - 2-3 soal melengkapi kalimat (fill in the blanks)
   - 2-3 soal menjawab pertanyaan berdasarkan bacaan
   - 1-2 soal menyusun kata menjadi kalimat

5. **Kunci Jawaban**: Berikan kunci jawaban untuk semua soal di atas.

Tampilkan dalam format yang rapi dengan judul modul di bagian atas. Gunakan bahasa Indonesia untuk instruksi soal.`;

  try {
    const response = await fetch('https://api.hcnsec.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-xhpBVY7MCNZZ9KgVykmDzzVvOCJJVCsRMxNCS3Iq5reJIahe'
      },
      body: JSON.stringify({
        model: 'DeepSeek-V4-Pro',
        messages: [
          { role: 'system', content: 'Anda adalah guru Bahasa Inggris SD yang berpengalaman. Buat materi pembelajaran yang menarik, mudah dipahami, dan sesuai untuk anak SD kelas 1-3. Gunakan bahasa Indonesia untuk instruksi.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      res.json({ content: data.choices[0].message.content });
    } else {
      res.status(500).json({ error: 'Gagal mendapatkan respons dari AI', detail: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NewSantara Private Course running at http://localhost:${PORT}`);
});
