import { Pool, PoolConfig } from 'pg';
import { config } from '../config';

// Use DATABASE_URL if available (preferred for Render/cloud databases), otherwise use individual parameters
const poolConfig: PoolConfig = config.database.url 
  ? {
      connectionString: config.database.url,
      max: 10, // Reduced pool size for remote connections
      idleTimeoutMillis: 10000, // Close idle clients after 10 seconds
      connectionTimeoutMillis: 10000, // Increased timeout for remote connections (10 seconds)
      statement_timeout: 30000, // Query timeout (30 seconds)
      query_timeout: 30000, // Query timeout (30 seconds)
    }
  : {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };

export const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}