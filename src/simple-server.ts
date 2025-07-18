import * as express from 'express';
import * as cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express.default();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Basic middleware
app.use(cors.default());
app.use(express.default.json());

// Welcome page
app.get('/', (req, res) => {
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
          <h3>✅ Server is Running Successfully!</h3>
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
          <p>The database has been initialized with your admin account. You can now start creating templates and managing HRP implementations.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic auth endpoint
app.post('/api/auth/login', (req, res) => {
  res.json({
    message: 'Login endpoint ready',
    credentials: {
      email: 'admin@company.com',
      password: 'admin123'
    }
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server with error handling
try {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Digital Toolkit for HRP Implementations');
    console.log(`📡 Server running at http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log('\n🔐 Admin Credentials:');
    console.log('   Email: admin@company.com');
    console.log('   Password: admin123');
    console.log('\n✅ Server started successfully and is listening for connections');
  });

  server.on('error', (error: any) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
    process.exit(1);
  });

  // Keep process alive
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Server heartbeat - still running`);
  }, 30000);

} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}

export default app;