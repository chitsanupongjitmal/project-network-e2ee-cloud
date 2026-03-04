
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const useSsl = process.env.DB_SSL === 'true';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
const caPath = process.env.DB_SSL_CA_PATH;

const ssl = (() => {
  if (!useSsl) return undefined;
  if (caPath) {
    return {
      ca: fs.readFileSync(caPath, 'utf8'),
      rejectUnauthorized
    };
  }
  return { rejectUnauthorized };
})();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pj_network',
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('MySQL Connection Pool created.');

module.exports = pool;
