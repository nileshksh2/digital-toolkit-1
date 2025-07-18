// Production-ready deployment server
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('🚀 Starting Digital Toolkit for HRP Implementations...');

// Basic middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database setup
let db: any = null;

async function initializeDatabase() {
  try {
    const dbPath = process.env.DATABASE_URL || './data/production.sqlite';
    const dataDir = path.dirname(dbPath);
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Open database
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON');

    // Create users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK(role IN ('system_admin', 'project_manager', 'team_member', 'customer')),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create phases table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS phases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL,
        sequence_order INTEGER NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default phases
    await db.exec(`
      INSERT OR IGNORE INTO phases (name, sequence_order, description) VALUES
      ('Design', 1, 'Project design and planning phase'),
      ('Configuration', 2, 'System configuration and setup phase'),
      ('Testing', 3, 'Testing and quality assurance phase'),
      ('Promotion', 4, 'Production deployment and go-live phase')
    `);

    // Create admin user if doesn't exist
    const existingAdmin = await db.get('SELECT id FROM users WHERE email = ?', ['admin@company.com']);
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await db.run(`
        INSERT INTO users (
          username, email, password_hash, first_name, last_name, role, 
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        'admin',
        'admin@company.com',
        hashedPassword,
        'System',
        'Administrator',
        'system_admin'
      ]);
      console.log('✅ Admin user created');
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Routes
app.get('/', (req: any, res: any) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Digital Toolkit for HRP Implementations</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container { 
          max-width: 800px; background: white; padding: 40px; border-radius: 20px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 2.5em; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 1.2em; }
        .status { background: #e7f3ff; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .credentials { 
          background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; 
          border-left: 4px solid #28a745; text-align: left;
        }
        .api-info { background: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0; }
        code { background: #f1f1f1; padding: 3px 8px; border-radius: 5px; font-family: 'Monaco', monospace; }
        .btn { 
          display: inline-block; padding: 12px 24px; background: #007bff; color: white; 
          text-decoration: none; border-radius: 8px; margin: 10px; transition: background 0.3s;
        }
        .btn:hover { background: #0056b3; }
        ul { list-style: none; padding: 0; }
        li { padding: 8px 0; border-bottom: 1px solid #eee; }
        .footer { margin-top: 30px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Digital Toolkit</h1>
        <div class="subtitle">HRP Implementation Monitoring System</div>
        
        <div class="status">
          <h3>✅ Successfully Deployed!</h3>
          <p>Your Implementation Monitoring System is running in the cloud</p>
          <p><strong>Environment:</strong> Production • <strong>Version:</strong> 1.0.0</p>
        </div>

        <div class="credentials">
          <h3>🔐 Admin Access</h3>
          <ul>
            <li><strong>Email:</strong> <code>admin@company.com</code></li>
            <li><strong>Username:</strong> <code>admin</code></li>
            <li><strong>Password:</strong> <code>admin123</code></li>
          </ul>
          <p><em>Use these credentials to start creating templates and managing HRP implementations.</em></p>
        </div>

        <div class="api-info">
          <h3>🌐 API Endpoints</h3>
          <a href="/api/health" class="btn">Health Check</a>
          <a href="/api/users" class="btn">Users API</a>
          <a href="/api/phases" class="btn">Phases API</a>
        </div>

        <div class="footer">
          <p>🎯 Ready to manage your HRP implementations with hierarchical project tracking</p>
          <p>Epic → Stories → Tasks → Subtasks • Customer Portals • Dynamic Forms</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/health', (req: any, res: any) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    database: db ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

app.get('/api/users', async (req: any, res: any) => {
  try {
    const users = await db.all(`
      SELECT id, username, email, first_name, last_name, role, is_active, created_at 
      FROM users 
      WHERE is_active = true
    `);
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

app.get('/api/phases', async (req: any, res: any) => {
  try {
    const phases = await db.all(`
      SELECT * FROM phases 
      WHERE is_active = true 
      ORDER BY sequence_order
    `);
    res.json({
      success: true,
      data: phases,
      count: phases.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch phases'
    });
  }
});

app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = true', [email]);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// 404 handler
app.use('*', (req: any, res: any) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    
    const server = app.listen(PORT, () => {
      console.log('🚀 Digital Toolkit for HRP Implementations');
      console.log(`📡 Server running at http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log('\n🔐 Admin Credentials:');
      console.log('   Email: admin@company.com');
      console.log('   Password: admin123');
      console.log('\n✅ Ready for deployment!');
    });

    server.on('error', (error: any) => {
      console.error('❌ Server error:', error);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;