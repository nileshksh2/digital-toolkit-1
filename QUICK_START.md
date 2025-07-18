# Quick Start Guide - Digital Toolkit for HRP Implementations

## 🚀 One-Command Setup

```bash
# Make the start script executable and run it
chmod +x start.sh && ./start.sh
```

The script will:
1. ✅ Check Node.js 18+ installation
2. 📝 Create `.env` configuration file
3. 📦 Install all dependencies
4. 🗄️ Initialize SQLite database
5. 🌱 Seed with sample data
6. 🔥 Start development server

## 🌐 Access the Application

Once started, you can access:

- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health  
- **Sample Customer Portal**: http://localhost:3000/portal/acme-portal-key-123

## 🔐 Default Login Credentials

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **System Admin** | admin@company.com | admin123 | Full system access |
| **Project Manager** | pm@company.com | pm123 | Project management |
| **Developer** | developer@company.com | dev123 | Team member |
| **Customer** | customer@client.com | customer123 | Customer portal |

## 📡 API Endpoints

### Authentication
```bash
# Login
POST /api/auth/login
{
  "email": "admin@company.com",
  "password": "admin123"
}

# Get current user
GET /api/auth/me
```

### Epic Management
```bash
GET /api/epics              # List all epics
POST /api/epics             # Create new epic
GET /api/epics/1            # Get epic details
PUT /api/epics/1            # Update epic
```

### Comments (Dual-Layer)
```bash
GET /api/comments/epic/1    # Get epic comments
POST /api/comments          # Create comment
{
  "entity_type": "epic",
  "entity_id": 1,
  "content": "This is a comment",
  "is_internal": false
}
```

### Customer Portal (Public)
```bash
GET /api/portal/acme-portal-key-123           # Portal data
POST /api/portal/acme-portal-key-123/comments # Submit comment
GET /api/portal/acme-portal-key-123/report    # Download report
```

### Forms & Templates
```bash
GET /api/forms              # List forms
POST /api/forms             # Create form
GET /api/templates          # List templates
POST /api/templates/1/apply # Apply template
```

## 🛠️ Development Commands

```bash
# Development
npm run dev                 # Start with auto-reload
npm run build              # Build for production
npm start                  # Start production server

# Database
npm run db:init            # Initialize schema
npm run db:seed            # Add sample data
npm run db:reset           # Reset database

# Code Quality
npm run lint               # Check code style
npm run typecheck          # TypeScript validation
npm test                   # Run tests
```

## 🏗️ Project Structure

```
src/
├── api/                   # REST API layer
│   ├── controllers/       # Request handlers
│   ├── routes/           # Route definitions
│   └── middleware/       # Auth, validation, etc.
├── modules/              # Business logic
│   ├── epic-management/  # Hierarchical tasks
│   ├── phase-tracking/   # 4-phase workflow
│   ├── templates/        # Reusable templates
│   ├── access-control/   # Auth & permissions
│   ├── customer-portal/  # Customer interface
│   ├── forms/           # Dynamic forms
│   └── comments/        # Dual-layer comments
├── frontend/            # React components
├── database/            # Schema & migrations
└── shared/              # Types & utilities
```

## 🔧 Key Features

### ✨ Hierarchical Project Management
- **Epic** → **Stories** → **Tasks** → **Subtasks**
- Automatic progress calculation bubbling up
- Drag & drop reordering

### 📊 Phase Tracking
- 4 sequential phases: Design → Configuration → Testing → Promotion
- State machine with validation rules
- Timeline visualization with progress bars

### 👥 Role-Based Access Control
- **System Admin**: Full access
- **Project Manager**: Project oversight
- **Team Member**: Task execution
- **Customer**: Portal-only access

### 🌐 Customer Portal
- Unique URLs per project
- Customizable visibility settings
- Real-time progress updates
- PDF/Excel report generation

### 💬 Dual-Layer Comments
- **Internal**: Team-only discussions
- **Customer**: Client-visible feedback
- Threaded conversations with attachments
- Real-time notifications

### 📝 Dynamic Form Builder
- Drag & drop field editor
- Conditional logic support
- Multiple field types
- Real-time validation

## 🧪 Sample Data Included

- **1 Customer**: Acme Corporation
- **1 Epic**: HRP Implementation with 3 stories
- **4 Users**: Admin, PM, Developer, Customer
- **4 Phases**: Design, Configuration, Testing, Promotion
- **Sample Comments**: Internal and customer-visible
- **Template**: Standard HRP Implementation

## 🌍 Production Deployment

```bash
# Build for production
npm run build

# Set environment
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@host:5432/db

# Start production server
npm start
```

## 🆘 Troubleshooting

### Common Issues

1. **Port 3000 already in use**
   ```bash
   # Change port in .env file
   PORT=3001
   ```

2. **Database connection errors**
   ```bash
   # Reset database
   npm run db:reset
   ```

3. **Permission errors**
   ```bash
   # Fix file permissions
   chmod 755 uploads logs data
   ```

4. **Node.js version issues**
   ```bash
   # Check version (requires 18+)
   node --version
   ```

## 📞 Support

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check README.md for detailed docs
- **API Docs**: Visit /api/docs (coming soon)

---

🎉 **You're all set!** The Digital Toolkit for HRP Implementations is now running and ready for development.