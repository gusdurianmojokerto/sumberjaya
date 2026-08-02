const express = require('express');
const path = require('path');
const { generatePaperContent } = require('./lib/paper');
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// AI Paper Generation
app.post('/api/generate-paper', async (req, res) => {
  const { jilid, topic, title } = req.body;
  if (!topic) return res.status(400).json({ error: 'Tema wajib diisi' });

  try {
    const content = await generatePaperContent({ jilid, topic, title });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NewSantara Private Course running at http://localhost:${PORT}`);
});
