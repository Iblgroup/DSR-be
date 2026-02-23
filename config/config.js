import dotenv from 'dotenv';

dotenv.config();

export const config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      statement_timeout: 120000,   // kill query after 2 minutes
      idle_in_transaction_session_timeout: 120000,
    },
    pool: {
      max: 50,
      min: 30,
      acquire: 300000,
      idle: 10000,
    },
  },
  server: {
    port: process.env.PORT || 3008,
    env: process.env.NODE_ENV || 'development',
  },
};
