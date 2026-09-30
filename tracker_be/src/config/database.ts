import 'dotenv/config';
import mysql from 'mysql2/promise';

// Pool tái sử dụng kết nối thay vì mở kết nối mới cho mỗi request.
export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'reading_tracker',
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: true,
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 20,
  connectTimeout: 5000,
});
