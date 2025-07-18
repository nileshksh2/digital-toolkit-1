// Using require instead of import to avoid esModuleInterop issues
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('🔄 Starting server initialization...');

// Basic middleware
app.use(cors());
app.use(express.json());

console.log('✅ Middleware configured');

// Welcome page
app.get('/', (req: any, res: any) => {
  console.log('📥 Root route accessed');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Digital Toolkit for HRP Implementations</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .credentials { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745; }
        code { background: #f1f1f1; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Digital Toolkit for HRP Implementations</h1>
        
        <div class="info">
          <h3>✅ TypeScript Server is Running Successfully!</h3>
          <p>Your Implementation Monitoring System (IMS) is up and running at <strong>http://localhost:3000</strong></p>
          <p><strong>Environment:</strong> Development</p>
          <p><strong>Version:</strong> 1.0.0</p>
        </div>

        <div class="credentials">
          <h3>🔐 Admin Login Credentials</h3>
          <ul>
            <li><strong>Email:</strong> <code>admin@company.com</code></li>
            <li><strong>Username:</strong> <code>admin</code></li>
            <li><strong>Password:</strong> <code>admin123</code></li>
          </ul>
          <p><em>Use these credentials to create templates and manage the system.</em></p>
        </div>

        <div class="info">
          <h3>📚 System Ready</h3>
          <p>The TypeScript server is now working correctly. You can proceed with creating templates and managing HRP implementations.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get('/api/health', (req: any, res: any) => {
  console.log('📥 Health check accessed');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    server: 'TypeScript Express Server'
  });
});

// Basic auth endpoint
app.post('/api/auth/login', (req: any, res: any) => {
  console.log('📥 Login attempt:', req.body);
  res.json({
    message: 'Login endpoint ready',
    credentials: {
      email: 'admin@company.com',
      password: 'admin123'
    }
  });
});

console.log('✅ Routes configured');

// Error handling
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
console.log('🔄 Attempting to bind to port...');

const server = app.listen(PORT, () => {
  console.log('🚀 Digital Toolkit for HRP Implementations');
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('\n🔐 Admin Credentials:');
  console.log('   Email: admin@company.com');
  console.log('   Password: admin123');
  console.log('\n✅ TypeScript server started successfully and is listening for connections');
  
  // Test immediate connection
  setTimeout(() => {
    console.log('🔍 Testing internal connection...');
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res: any) => {
      console.log('✅ Internal test successful:', res.statusCode);
      res.on('data', (chunk: any) => {
        console.log('📥 Response:', chunk.toString());
      });
    });

    req.on('error', (e: any) => {
      console.error('❌ Internal test failed:', e.message);
    });

    req.end();
  }, 2000);
});

server.on('error', (error: any) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

server.on('listening', () => {
  console.log('🎯 Server is now listening for connections');
});

// Keep process alive with heartbeat
let heartbeatCount = 0;
setInterval(() => {
  heartbeatCount++;
  console.log(`[${new Date().toISOString()}] ❤️  TypeScript Server heartbeat #${heartbeatCount} - still running`);
}, 10000);

export default app;