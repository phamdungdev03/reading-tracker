import type { RequestHandler } from 'express';
import { ApiError } from '../middlewares/error-handler';
import { searchOpenLibrary, SEARCH_LIMIT, getOpenLibraryBook } from '../services/open-library.service';
import { findShelfWorkIds, findSavedBook } from '../repositories/books.repository';

export const searchBooks: RequestHandler = async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rawPage = req.query.page ?? '1';
  const page = typeof rawPage === 'string' && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : NaN;
  const fields: Record<string, string> = {};

  if (q.length < 3) fields.q = 'Vui lòng nhập ít nhất 3 ký tự để tìm kiếm.';
  else if (q.length > 200) fields.q = 'Từ khóa không được vượt quá 200 ký tự.';
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(page * SEARCH_LIMIT)) {
    fields.page = 'Trang phải là số nguyên dương hợp lệ.';
  }
  if (Object.keys(fields).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', fields);
  }

  const result = await searchOpenLibrary(q, page);
  // Chỉ một query cho cả trang, không query riêng từng sách.
  const shelfIds = await findShelfWorkIds(result.items.map(book => book.workId));
  res.json({
    data: result.items.map(book => ({ ...book, inShelf: shelfIds.has(book.workId) })),
    pagination: { page, limit: SEARCH_LIMIT, total: result.total },
  });
};

export const getBookDetails: RequestHandler = async (req, res) => {
  const workId = req.params.workId;
  if (typeof workId !== 'string' || workId.length > 32 || !/^OL[1-9]\d*W$/.test(workId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Mã sách không hợp lệ.', {
      workId: 'Work ID phải có dạng OL27482W.',
    });
  }

  const saved = await findSavedBook(workId);
  if (saved) {
    res.json({ data: saved });
    return;
  }

  const book = await getOpenLibraryBook(workId);
  // Đọc lại membership sau upstream để phản ánh mục tủ vừa được thêm trong lúc chờ.
  const shelfIds = await findShelfWorkIds([workId]);
  res.json({ data: { ...book, inShelf: shelfIds.has(workId) } });
};
