const { Pool } = require('pg');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

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

const connectPostgres = async () => {
  await pool.query(initSql);
  logger.info('PostgreSQL connected and tables ensured');
};

const connectMongo = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info('MongoDB connected');
};

module.exports = { pool, connectPostgres, connectMongo };
