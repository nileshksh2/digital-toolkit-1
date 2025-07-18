import { app, server } from './app';
import { initializeDatabase } from './database/init';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
  try {
    // Initialize database
    console.log('🔄 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Start the server
    server.listen(PORT, () => {
      console.log('🚀 Digital Toolkit for HRP Implementations');
      console.log(`📡 Server running at http://${HOST}:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n🔧 Development URLs:');
        console.log(`   API Documentation: http://${HOST}:${PORT}/api/docs`);
        console.log(`   Sample Customer Portal: http://${HOST}:${PORT}/portal/[portal-key]`);
        console.log('\n📝 Default Login Credentials:');
        console.log('   Admin: admin@company.com / admin123');
        console.log('   PM: pm@company.com / pm123');
        console.log('   Developer: developer@company.com / dev123');
        console.log('   Customer: customer@client.com / customer123');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();