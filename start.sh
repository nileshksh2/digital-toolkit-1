#!/bin/bash

# Digital Toolkit for HRP Implementations - Quick Start Script

echo "🚀 Starting Digital Toolkit for HRP Implementations..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo "✅ npm $(npm -v) detected"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created from .env.example"
    echo "📝 You can edit .env to customize your configuration"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p data
mkdir -p uploads
mkdir -p logs
echo "✅ Directories created"

# Initialize database
echo "🗄️  Initializing database..."
npm run db:init
if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize database"
    exit 1
fi
echo "✅ Database initialized"

# Seed database with sample data
echo "🌱 Seeding database with sample data..."
npm run db:seed
if [ $? -ne 0 ]; then
    echo "❌ Failed to seed database"
    exit 1
fi
echo "✅ Database seeded with sample data"

# Start the development server
echo "🔥 Starting development server..."
echo ""
echo "📋 Default Login Credentials:"
echo "   System Admin: admin@company.com / admin123"
echo "   Project Manager: pm@company.com / pm123"
echo "   Developer: developer@company.com / dev123"
echo "   Customer: customer@client.com / customer123"
echo ""
echo "🌐 The server will start at http://localhost:3000"
echo "📊 Health check: http://localhost:3000/api/health"
echo "🔄 Customer Portal: http://localhost:3000/portal/acme-portal-key-123"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev