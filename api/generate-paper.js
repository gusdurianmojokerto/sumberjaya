const { generatePaperContent } = require('../lib/paper');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jilid, topic, title } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Tema wajib diisi' });

  try {
    const content = await generatePaperContent({ jilid, topic, title });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
