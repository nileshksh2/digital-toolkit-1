# Deployment Guide

## Quick Deploy Options

### Option 1: Railway (Recommended)
**Best for: Full-stack apps with persistent database**

1. Visit [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-detect Node.js and deploy

**Automatic deployment with zero configuration!**

### Option 2: Render (Free Tier)
**Best for: Free hosting with persistent storage**

1. Visit [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New Web Service"
4. Connect this repository
5. Use settings:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node

### Option 3: Vercel (Serverless)
**Best for: Serverless deployment**

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts to deploy

## Manual Build & Deploy

```bash
# 1. Build the application
npm run build

# 2. Set production environment
export NODE_ENV=production

# 3. Start the production server
npm start
```

## Environment Variables

For production deployment, set these environment variables:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=./data/production.sqlite
JWT_SECRET=your-secure-secret-here
CORS_ORIGIN=*
```

## Database Setup

The application will automatically:
1. Create SQLite database file
2. Initialize schema
3. Create admin user with credentials:
   - Email: `admin@company.com`
   - Password: `admin123`

## Access Your Deployed App

Once deployed, you'll get a URL like:
- Railway: `https://your-app.railway.app`
- Render: `https://your-app.onrender.com`  
- Vercel: `https://your-app.vercel.app`

Visit the URL to see your Digital Toolkit for HRP Implementations running in the cloud!

## Admin Access

Use these credentials to login:
- **Email:** admin@company.com
- **Password:** admin123

## API Endpoints

- `GET /` - Welcome page
- `GET /api/health` - Health check
- `POST /api/auth/login` - Authentication
- All other endpoints will be available once deployed

## Troubleshooting

If deployment fails:
1. Check build logs for errors
2. Ensure all dependencies are in package.json
3. Verify Node.js version compatibility
4. Check environment variables are set correctly