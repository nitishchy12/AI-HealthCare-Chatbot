const { Pool } = require('pg');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });
let postgresConnected = false;
let mongoConnected = false;

const initSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(80) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(20),
  latitude VARCHAR(25),
  longitude VARCHAR(25),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diseases (
  id SERIAL PRIMARY KEY,
  disease_name VARCHAR(120) UNIQUE NOT NULL,
  symptoms TEXT NOT NULL,
  prevention TEXT NOT NULL,
  treatment TEXT NOT NULL,
  risk_factors TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

const ensureConstraints = async () => {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hospitals_name_city_address_key'
      ) THEN
        ALTER TABLE hospitals ADD CONSTRAINT hospitals_name_city_address_key UNIQUE (name, city, address);
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END $$;
  `);
};

const connectPostgres = async () => {
  try {
    await pool.query('SELECT 1');
    await pool.query(initSql);
    await ensureConstraints();
    postgresConnected = true;
    logger.info('PostgreSQL connected and validated');
  } catch (error) {
    postgresConnected = false;
    logger.error('PostgreSQL connection failed', { error: error.message });
    throw error;
  }
};

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    mongoConnected = mongoose.connection.readyState === 1;
    logger.info('MongoDB connected and validated');
  } catch (error) {
    mongoConnected = false;
    logger.error('MongoDB connection failed', { error: error.message });
    throw error;
  }
};

const getDbHealth = () => ({ postgres: postgresConnected, mongo: mongoConnected });

const closeConnections = async () => {
  try {
    await pool.end();
  } catch (_error) {
    logger.warn('PostgreSQL pool close failed');
  }

  try {
    await mongoose.connection.close(false);
  } catch (_error) {
    logger.warn('MongoDB close failed');
  }

  postgresConnected = false;
  mongoConnected = false;
  logger.info('Database connections closed');
};

module.exports = { pool, connectPostgres, connectMongo, closeConnections, getDbHealth };
