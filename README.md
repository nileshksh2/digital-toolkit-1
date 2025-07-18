# 🚀 Digital Toolkit for HRP Implementations

A comprehensive Implementation Monitoring System (IMS) for managing HRP implementations with hierarchical project tracking, customer portals, and dynamic forms.

## ✨ Features

- **📋 Hierarchical Project Management** - Epic → Stories → Tasks → Subtasks
- **📊 Phase Tracking** - 4 sequential phases (Design, Configuration, Testing, Promotion)
- **🏢 Customer Portals** - Unique URLs for client access
- **📝 Dynamic Forms** - Custom form builder with validation
- **💬 Dual-Layer Comments** - Internal and customer-facing comments
- **👥 Role-Based Access** - System Admin, Project Manager, Team Member, Customer
- **📱 Responsive Design** - Works on desktop and mobile

## 🚀 Quick Deploy

### Deploy to Railway (Recommended)
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-detect and deploy!

### Deploy to Render
1. Fork this repository
2. Go to [render.com](https://render.com)
3. Create a new Web Service
4. Connect your forked repository
5. Use build command: `npm install`
6. Use start command: `npm start`

### Deploy to Vercel
```bash
npm i -g vercel
vercel
```

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start deployment server (production-like)
npm run deploy
```

## 🔐 Default Credentials

**Admin Access:**
- Email: `admin@company.com`  
- Username: `admin`
- Password: `admin123`

## 📚 API Endpoints

- `GET /` - Welcome page with system overview
- `GET /api/health` - Health check and system status
- `GET /api/users` - List all active users
- `GET /api/phases` - List implementation phases
- `POST /api/auth/login` - User authentication

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Database:** SQLite (production-ready)
- **Authentication:** bcrypt, JWT
- **Deployment:** Ready for Railway, Render, Vercel

---

**🎯 Ready to streamline your HRP implementations!**