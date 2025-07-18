import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';

export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<any[]>;
  queryFirst(sql: string, params?: any[]): Promise<any>;
  run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export class SQLiteDatabaseConnection implements DatabaseConnection {
  constructor(private db: Database<sqlite3.Database, sqlite3.Statement>) {}

  async query(sql: string, params?: any[]): Promise<any[]> {
    return await this.db.all(sql, params);
  }

  async queryFirst(sql: string, params?: any[]): Promise<any> {
    return await this.db.get(sql, params);
  }

  async run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }> {
    const result = await this.db.run(sql, params);
    return {
      lastID: result.lastID || 0,
      changes: result.changes || 0
    };
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}