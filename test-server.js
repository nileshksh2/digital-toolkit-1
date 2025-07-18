const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Digital Toolkit Test Server</h1>
    <p>Server is working at http://localhost:3000</p>
    <p><strong>Admin Credentials:</strong></p>
    <ul>
      <li>Email: admin@company.com</li>
      <li>Password: admin123</li>
    </ul>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});