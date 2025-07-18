import bcrypt from 'bcrypt';
import { getDatabase } from './init';

async function seedMinimalData(): Promise<void> {
  const db = await getDatabase();

  console.log('🌱 Creating admin user...');

  try {
    // Create admin user only
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    await db.run(`
      INSERT OR IGNORE INTO users (
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

    console.log('✅ Admin user created successfully');
    console.log('\n📊 Login credentials:');
    console.log('  Username: admin');
    console.log('  Email: admin@company.com');
    console.log('  Password: admin123');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

// Run seeding
seedMinimalData()
  .then(() => {
    console.log('🎉 Minimal seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Minimal seeding failed:', error);
    process.exit(1);
  });