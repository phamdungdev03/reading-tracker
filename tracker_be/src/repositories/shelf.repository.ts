import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/database';
import { ApiError } from '../middlewares/error-handler';
import type { BookDetails } from '../types/book';
import type { AddShelfInput, ShelfItem } from '../types/shelf';

const selectShelf = `SELECT sb.*, b.open_library_work_id, b.title, b.authors,
  b.cover_id, b.first_publish_year, b.description, b.subjects
  FROM shelf_books sb JOIN books b ON b.id = sb.book_id`;

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value.replace(' ', 'T') + 'Z').toISOString();
}
function strings(value: unknown): string[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}
function mapItem(row: RowDataPacket): ShelfItem {
  return {
    id: String(row.id), bookId: String(row.book_id), workId: row.open_library_work_id,
    title: row.title, authors: strings(row.authors),
    coverUrl: row.cover_id > 0 ? `/api/covers/${row.cover_id}` : null,
    firstPublishYear: row.first_publish_year ?? null,
    description: row.description ?? null, subjects: strings(row.subjects),
    status: row.status, totalPages: row.total_pages, currentPage: row.current_page,
    progressPercent: Math.floor(row.current_page * 100 / row.total_pages),
    rating: row.rating, notes: row.notes,
    startedAt: iso(row.started_at), finishedAt: iso(row.finished_at),
    createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!,
  };
}
function databaseError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    throw new ApiError(409, 'BOOK_ALREADY_IN_SHELF', 'Sách đã có trong tủ.');
  }
  throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể xử lý dữ liệu tủ sách.');
}

async function transaction<T>(run: (connection: PoolConnection) => Promise<T>): Promise<T> {
  let connection: PoolConnection | undefined;
  try {
    connection = await pool.getConnection();
    await connection.query("SET time_zone = '+00:00'");
    await connection.beginTransaction();
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch { connection.destroy(); }
    }
    return databaseError(error);
  } finally {
    connection?.release();
  }
}

export async function findAllShelfBooks(): Promise<ShelfItem[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>({ sql: `${selectShelf} ORDER BY sb.created_at DESC, sb.id DESC`, timeout: 5000 });
    return rows.map(mapItem);
  } catch (error) { return databaseError(error); }
}

export function insertShelfBook(book: BookDetails, input: AddShelfInput): Promise<ShelfItem> {
  return transaction(async connection => {
    const rawCover = book.coverUrl ? Number(book.coverUrl.split('/').pop()) : null;
    const coverId = rawCover !== null && Number.isInteger(rawCover) && rawCover > 0 && rawCover <= 2147483647 ? rawCover : null;
    const year = book.firstPublishYear !== null && book.firstPublishYear >= -32768 && book.firstPublishYear <= 32767 ? book.firstPublishYear : null;
    // UNIQUE work_id tuần tự hóa các lần thêm cùng Work, giữ metadata đã tồn tại.
    await connection.execute(`INSERT INTO books
      (open_library_work_id, title, authors, cover_id, description, subjects, first_publish_year)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [book.workId, book.title, JSON.stringify(book.authors), coverId, book.description, JSON.stringify(book.subjects), year]);
    const [books] = await connection.execute<RowDataPacket[]>('SELECT id FROM books WHERE open_library_work_id = ?', [book.workId]);
    const bookId = String(books[0]!.id);
    await connection.execute(`INSERT INTO shelf_books
      (book_id, status, total_pages, current_page, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [bookId, input.status, input.totalPages,
      input.status === 'completed' ? input.totalPages : 0,
      input.status === 'reading' ? new Date() : null,
      input.status === 'completed' ? new Date() : null]);
    const [rows] = await connection.execute<RowDataPacket[]>(`${selectShelf} WHERE sb.book_id = ?`, [bookId]);
    return mapItem(rows[0]!);
  });
}

export function updateShelfBook(id: string, compute: (current: ShelfItem) => ShelfItem): Promise<ShelfItem> {
  return transaction(async connection => {
    // Khóa mục tủ trước khi tính tiến độ; request đồng thời sẽ đọc bản mới nhất.
    const [locked] = await connection.execute<RowDataPacket[]>('SELECT id FROM shelf_books WHERE id = ? FOR UPDATE', [id]);
    if (!locked.length) throw new ApiError(404, 'SHELF_BOOK_NOT_FOUND', 'Không tìm thấy sách trong tủ.');
    const [rows] = await connection.execute<RowDataPacket[]>(`${selectShelf} WHERE sb.id = ?`, [id]);
    const next = compute(mapItem(rows[0]!));
    await connection.execute(`UPDATE shelf_books SET status = ?, current_page = ?, rating = ?, notes = ?,
      started_at = ?, finished_at = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
      [next.status, next.currentPage, next.rating, next.notes,
        next.startedAt ? new Date(next.startedAt) : null,
        next.finishedAt ? new Date(next.finishedAt) : null, id]);
    const [updated] = await connection.execute<RowDataPacket[]>(`${selectShelf} WHERE sb.id = ?`, [id]);
    return mapItem(updated[0]!);
  });
}

export async function deleteShelfBook(id: string): Promise<void> {
  try {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM shelf_books WHERE id = ?', [id]);
    if (!result.affectedRows) throw new ApiError(404, 'SHELF_BOOK_NOT_FOUND', 'Không tìm thấy sách trong tủ.');
  } catch (error) { databaseError(error); }
}
