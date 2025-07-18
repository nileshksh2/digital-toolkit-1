import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import { SQLiteDatabaseConnection, DatabaseConnection } from '../shared/types';

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
let dbConnection: DatabaseConnection | null = null;

export async function initializeDatabase(): Promise<DatabaseConnection> {
  if (dbConnection) {
    return dbConnection;
  }

  const dbPath = process.env.DATABASE_URL || './data/development.sqlite';
  
  // Ensure the data directory exists
  const dataDir = path.dirname(dbPath);
  await fs.mkdir(dataDir, { recursive: true });

  // Open database connection
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');

  // Create connection wrapper
  dbConnection = new SQLiteDatabaseConnection(db);

  // Initialize schema
  await initializeSchema(db);

  return dbConnection;
}

async function initializeSchema(database: Database<sqlite3.Database, sqlite3.Statement>): Promise<void> {
  try {
    const schemaPath = path.join(__dirname, 'schemas', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute them
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await database.exec(statement);
    }

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Error initializing database schema:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<DatabaseConnection> {
  if (!dbConnection) {
    dbConnection = await initializeDatabase();
  }
  return dbConnection;
}

export async function closeDatabase(): Promise<void> {
  if (dbConnection) {
    await dbConnection.close();
    dbConnection = null;
    db = null;
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 Database initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}