import { ApiError } from '../middlewares/error-handler';
import { findSavedBook } from '../repositories/books.repository';
import { getOpenLibraryBook } from './open-library.service';
import * as repository from '../repositories/shelf.repository';
import { invalid } from '../validators/shelf.validator';
import type { AddShelfInput, PatchShelfInput, ReadingStatus, ShelfItem } from '../types/shelf';

// Hàm thuần: tính trạng thái mới, không gọi DB hay Open Library.
export function applyShelfPatch(current: ShelfItem, patch: PatchShelfInput, now: string): ShelfItem {
  const next = { ...current };
  if (patch.currentPage !== undefined) {
    if (patch.currentPage > current.totalPages) invalid('currentPage', 'Trang hiện tại không được vượt tổng trang.');
    next.currentPage = patch.currentPage;
    if (next.currentPage === current.totalPages) {
      next.status = 'completed';
      next.finishedAt = current.finishedAt ?? now;
    } else if (next.currentPage > 0 || current.status === 'completed') {
      next.status = 'reading';
      next.startedAt = current.startedAt ?? now;
      next.finishedAt = null;
    }
  }
  if (patch.status !== undefined && patch.status !== current.status) {
    next.status = patch.status;
    if (patch.status === 'completed') {
      next.currentPage = current.totalPages;
      next.finishedAt = now;
    } else {
      next.finishedAt = null;
      if (patch.status === 'want_to_read' || current.status === 'completed') next.currentPage = 0;
      if (patch.status === 'reading') next.startedAt = current.startedAt ?? now;
    }
  }
  if (patch.rating !== undefined) next.rating = patch.rating;
  if (patch.notes !== undefined) next.notes = patch.notes;
  next.progressPercent = Math.floor(next.currentPage * 100 / next.totalPages);
  return next;
}

export async function addShelfBook(input: AddShelfInput) {
  const saved = await findSavedBook(input.workId);
  if (saved?.inShelf) throw new ApiError(409, 'BOOK_ALREADY_IN_SHELF', 'Sách đã có trong tủ.');
  // Chờ mạng trước transaction, tránh giữ khóa MySQL khi gọi upstream.
  const metadata = saved ?? await getOpenLibraryBook(input.workId);
  return repository.insertShelfBook(metadata, input);
}

export async function listShelfBooks(status?: ReadingStatus) {
  // Một snapshot SELECT cho cả danh sách và thống kê; tủ nhỏ chưa cần phân trang.
  const all = await repository.findAllShelfBooks();
  return {
    items: status ? all.filter(item => item.status === status) : all,
    stats: {
      total: all.length,
      reading: all.filter(item => item.status === 'reading').length,
      completed: all.filter(item => item.status === 'completed').length,
    },
  };
}

export function updateShelfBook(id: string, patch: PatchShelfInput) {
  return repository.updateShelfBook(id, current => applyShelfPatch(current, patch, new Date().toISOString()));
}
export const deleteShelfBook = repository.deleteShelfBook;
