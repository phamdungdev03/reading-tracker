import { ApiError } from '../middlewares/error-handler';
import type { AddShelfInput, PatchShelfInput, ReadingStatus } from '../types/shelf';

const statuses = new Set(['want_to_read', 'reading', 'completed']);
export function invalid(field: string, message: string): never {
  throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { [field]: message });
}
export function validateStatus(value: unknown): ReadingStatus {
  if (typeof value !== 'string' || !statuses.has(value)) invalid('status', 'Trạng thái không hợp lệ.');
  return value as ReadingStatus;
}
export function validateShelfId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value)
    || BigInt(value) > 18446744073709551615n) invalid('id', 'ID mục tủ không hợp lệ.');
  return value;
}
function bodyObject(value: unknown, allowed: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid('body', 'Body phải là object JSON.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid('body', 'Body chứa trường không được hỗ trợ.');
  return body;
}
function isPage(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= 2147483647;
}
export function validateAddShelf(value: unknown): AddShelfInput {
  const body = bodyObject(value, ['workId', 'status', 'totalPages']);
  if (typeof body.workId !== 'string' || body.workId.length > 32 || !/^OL[1-9]\d*W$/.test(body.workId)) {
    invalid('workId', 'Work ID phải có dạng OL27482W.');
  }
  const status = validateStatus(body.status);
  if (!isPage(body.totalPages, 1)) invalid('totalPages', 'Tổng trang phải là số nguyên dương trong giới hạn INT.');
  return { workId: body.workId, status, totalPages: body.totalPages };
}
export function validatePatchShelf(value: unknown): PatchShelfInput {
  const body = bodyObject(value, ['status', 'currentPage', 'rating', 'notes']);
  if (!Object.keys(body).length) invalid('body', 'Cần ít nhất một trường để cập nhật.');
  if ('status' in body && 'currentPage' in body) invalid('body', 'Không gửi đồng thời status và currentPage.');
  const patch: PatchShelfInput = {};
  if ('status' in body) patch.status = validateStatus(body.status);
  if ('currentPage' in body) {
    if (!isPage(body.currentPage, 0)) invalid('currentPage', 'Trang hiện tại phải là số nguyên không âm.');
    patch.currentPage = body.currentPage;
  }
  if ('rating' in body) {
    if (body.rating !== null && (typeof body.rating !== 'number' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
      invalid('rating', 'Đánh giá phải là số nguyên 1–5 hoặc null.');
    }
    patch.rating = body.rating as number | null;
  }
  if ('notes' in body) {
    if (body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 1000)) {
      invalid('notes', 'Ghi chú tối đa 1.000 ký tự hoặc null.');
    }
    patch.notes = body.notes as string | null;
  }
  return patch;
}
