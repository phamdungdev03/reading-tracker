import { ApiError } from '../middlewares/error-handler';

const MAX_COVER_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function fetchCover(coverId: string): Promise<{ buffer: Buffer; contentType: string }> {
  // Host và kích thước cố định; client chỉ truyền ID, không truyền URL.
  const url = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'image/*', 'User-Agent': 'ReadingTracker/1.0' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) throw new ApiError(404, 'COVER_NOT_FOUND', 'Không tìm thấy ảnh bìa.');
      throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Không thể lấy ảnh bìa từ Open Library.');
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!contentType || !IMAGE_TYPES.has(contentType) || !response.body) {
      await response.body?.cancel();
      throw new ApiError(502, 'INVALID_COVER', 'Dữ liệu ảnh bìa không hợp lệ.');
    }
    // Đọc theo từng chunk để giới hạn bộ nhớ cả khi upstream không gửi Content-Length.
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_COVER_BYTES) {
          await reader.cancel();
          throw new ApiError(502, 'INVALID_COVER', 'Ảnh bìa vượt quá kích thước cho phép.');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    if (size === 0) throw new ApiError(502, 'INVALID_COVER', 'Dữ liệu ảnh bìa trống.');
    return { buffer: Buffer.concat(chunks), contentType };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiError(504, 'OPEN_LIBRARY_TIMEOUT', 'Open Library phản hồi ảnh bìa quá chậm.');
    }
    throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Không thể lấy ảnh bìa từ Open Library.');
  }
}
