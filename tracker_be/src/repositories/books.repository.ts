import type { SavedBookDetails } from '../types/book';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/database';
import { ApiError } from '../middlewares/error-handler';

export async function findShelfWorkIds(workIds: string[]): Promise<Set<string>> {
  if (workIds.length === 0) return new Set();

  const placeholders = workIds.map(() => '?').join(', ');
  try {
    const [rows] = await pool.query<RowDataPacket[]>({
      sql: `SELECT b.open_library_work_id
            FROM books b JOIN shelf_books sb ON sb.book_id = b.id
            WHERE b.open_library_work_id IN (${placeholders})`,
      values: workIds,
      timeout: 5000,
    });
    return new Set(rows.map(row => String(row.open_library_work_id)));
  } catch {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể đọc dữ liệu tủ sách.');
  }
}

function stringArray(value: unknown): string[] {
  // mysql2 thường parse JSON sẵn; hỗ trợ cả trường hợp trả chuỗi JSON.
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

export async function findSavedBook(workId: string): Promise<SavedBookDetails | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>({
      sql: `SELECT b.*, (sb.id IS NOT NULL) AS in_shelf
            FROM books b LEFT JOIN shelf_books sb ON sb.book_id = b.id
            WHERE b.open_library_work_id = ? LIMIT 1`,
      values: [workId],
      timeout: 5000,
    });
    const row = rows[0];
    if (!row) return null;
    return {
      workId: row.open_library_work_id,
      title: row.title,
      authors: stringArray(row.authors),
      coverUrl: row.cover_id > 0 ? `/api/covers/${row.cover_id}` : null,
      firstPublishYear: row.first_publish_year ?? null,
      description: row.description ?? null,
      subjects: stringArray(row.subjects),
      // Schema books không lưu số trang edition; không nhầm với tổng trang cá nhân.
      suggestedTotalPages: null,
      suggestedEditionId: null,
      inShelf: Number(row.in_shelf) === 1,
    };
  } catch {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể đọc thông tin sách đã lưu.');
  }
}
