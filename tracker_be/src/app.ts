import express from 'express';
import { shelfRouter } from './routes/shelf.routes';
import { coversRouter } from './routes/covers.routes';
import { booksRouter } from './routes/books.routes';
import { errorHandler } from './middlewares/error-handler';
import { pool } from './config/database';

export const app = express();
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    // Chỉ kiểm tra MySQL trả lời được, không đọc hay sửa dữ liệu sách.
    await pool.query({ sql: 'SELECT 1', timeout: 5000 });

    res.status(200).json({
      data: { status: 'ok', database: 'ok' },
    });
  } catch {
    // Không gửi lỗi SQL hoặc thông tin kết nối về client.
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Không thể kết nối database.',
      },
    });
  }
});

app.use('/api/books', booksRouter);
app.use('/api/covers', coversRouter);
app.use('/api/shelf', shelfRouter);
app.use(errorHandler);
