const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Sumber Jaya Private Course running at http://localhost:${PORT}`);
});
