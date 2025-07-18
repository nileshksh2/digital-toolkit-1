import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { config } from 'dotenv';
import { createServer } from 'http';

// Load environment variables
config();

// Import middleware
import { errorHandler } from './api/middleware/error-handler';

// For now, create simple placeholder routes
import { Router } from 'express';

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Create basic placeholder routes
const authRouter = Router();
authRouter.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - implementation pending' });
});

const apiRouter = Router();
apiRouter.get('/epics', (req, res) => {
  res.json({ message: 'Epics API - implementation pending' });
});

// Simple auth middleware placeholder
const simpleAuth = (req: any, res: any, next: any) => {
  // For now, just pass through - implement proper auth later
  next();
};

// API Routes
app.use('/api/auth', authRouter);
app.use('/api', simpleAuth, apiRouter);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
} else {
  // Development route - serve a simple HTML page
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
          .api-links { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          code { background: #f1f1f1; padding: 2px 5px; border-radius: 3px; }
          ul { list-style-type: none; padding: 0; }
          li { padding: 5px 0; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
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

          <div class="api-links">
            <h3>🌐 Available Endpoints</h3>
            <ul>
              <li><a href="/api/health">🏥 Health Check</a> - System status</li>
              <li><a href="/api/auth/login">🔒 Login API</a> - Authentication (POST)</li>
              <li><a href="/api/epics">📋 Epics API</a> - Project management</li>
            </ul>
          </div>

          <div class="info">
            <h3>📚 Next Steps</h3>
            <ol>
              <li>Use the admin credentials to access the system</li>
              <li>Create templates for your HRP implementations</li>
              <li>Set up customer portals and projects</li>
              <li>Manage hierarchical tasks (Epics → Stories → Tasks → Subtasks)</li>
            </ol>
          </div>
        </div>
      </body>
      </html>
    `);
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export { app, server };
export default app;