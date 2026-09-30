import { ApiError } from '../middlewares/error-handler';
import type { BookSearchResult, SearchBook, BookDetails } from '../types/book';

export const SEARCH_LIMIT = 20;
const cache = new Map<string, { expiresAt: number; result: BookSearchResult }>();
let queue: Promise<void> = Promise.resolve();
let pending = 0;
let lastStarted = 0;

// Giãn thời điểm bắt đầu request ít nhất 1 giây; giới hạn hàng đợi.
async function waitForTurn(): Promise<void> {
  if (pending >= 40) throw new ApiError(503, 'UPSTREAM_BUSY', 'Đang có nhiều yêu cầu, vui lòng thử lại.');
  pending++;
  const turn = queue.then(async () => {
    const delay = Math.max(0, 1000 - (Date.now() - lastStarted));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastStarted = Date.now();
  });
  queue = turn.catch(() => {});
  try { await turn; } finally { pending--; }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeBook(value: unknown): SearchBook | null {
  if (!isObject(value) || typeof value.key !== 'string') return null;
  const workId = value.key.replace(/^\/works\//, '');
  if (!/^OL\d+W$/.test(workId)) return null;
  const coverId = value.cover_i;
  return {
    workId,
    title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Chưa có tên sách',
    authors: Array.isArray(value.author_name)
      ? value.author_name.filter((author): author is string => typeof author === 'string') : [],
    coverUrl: typeof coverId === 'number' && Number.isSafeInteger(coverId) && coverId > 0
      ? `/api/covers/${coverId}` : null,
    firstPublishYear: typeof value.first_publish_year === 'number' && Number.isInteger(value.first_publish_year)
      ? value.first_publish_year : null,
  };
}

export async function searchOpenLibrary(q: string, page: number): Promise<BookSearchResult> {
  const key = JSON.stringify([q, page]);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', q);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(SEARCH_LIMIT));
  url.searchParams.set('fields', 'key,title,author_name,cover_i,first_publish_year');

  try {
    const body = await fetchOpenLibraryJson(url);
    if (!isObject(body) || !Array.isArray(body.docs)) throw new Error('Invalid search payload');
    const total = body.numFound ?? body.num_found;
    if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) throw new Error('Invalid total');
    const result: BookSearchResult = {
      items: body.docs.map(normalizeBook).filter((book): book is SearchBook => book !== null),
      total,
    };
    // Chỉ cache metadata, luôn đọc lại membership từ DB để badge không bị cũ.
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expiresAt: Date.now() + 5 * 60 * 1000, result });
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiError(504, 'OPEN_LIBRARY_TIMEOUT', 'Open Library phản hồi quá chậm.');
    }
    throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Không thể lấy dữ liệu từ Open Library.');
  }
}

async function fetchOpenLibraryJson(url: URL, workRequest = false): Promise<unknown> {
  await waitForTurn();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json', 'User-Agent': 'ReadingTracker/1.0' },
    });
    if (!response.ok) {
      console.error('[Open Library] HTTP error', {
        url: url.href,
        status: response.status,
        statusText: response.statusText,
      });
      await response.body?.cancel();
      if (response.status === 404 && workRequest) {
        throw new ApiError(404, 'BOOK_NOT_FOUND', 'Không tìm thấy sách.');
      }
      throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Open Library hiện không trả được dữ liệu.');
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[Open Library] Request failed', {
      url: url.href,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown failure',
      causeCode: isObject(error) && isObject(error.cause) ? error.cause.code : undefined,
    });
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiError(504, 'OPEN_LIBRARY_TIMEOUT', 'Open Library phản hồi quá chậm.');
    }
    throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Không thể lấy dữ liệu từ Open Library.');
  }
}

const detailsCache = new Map<string, { expiresAt: number; result: BookDetails }>();

export async function getOpenLibraryBook(workId: string): Promise<BookDetails> {
  const cached = detailsCache.get(workId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const work = await fetchOpenLibraryJson(new URL(`https://openlibrary.org/works/${workId}.json`), true);
  if (!isObject(work) || work.key !== `/works/${workId}`) {
    throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Dữ liệu sách từ Open Library không hợp lệ.');
  }

  // Search index cung cấp tên tác giả và năm xuất bản đầu tiên của Work.
  const search = await searchOpenLibrary(`key:/works/${workId}`, 1);
  const summary = search.items.find(book => book.workId === workId);
  const editions = await fetchOpenLibraryJson(new URL(`https://openlibrary.org/works/${workId}/editions.json?limit=20`));
  if (!isObject(editions) || !Array.isArray(editions.entries)) {
    throw new ApiError(502, 'OPEN_LIBRARY_ERROR', 'Dữ liệu phiên bản sách không hợp lệ.');
  }
  // Chỉ gợi ý từ một edition có số trang thật; không suy đoán từ Work.
  const edition = editions.entries.find((entry: unknown) => isObject(entry)
    && typeof entry.key === 'string' && /^\/books\/OL\d+M$/.test(entry.key)
    && typeof entry.number_of_pages === 'number' && Number.isInteger(entry.number_of_pages)
    && entry.number_of_pages > 0 && entry.number_of_pages <= 2147483647) as Record<string, unknown> | undefined;
  const description = typeof work.description === 'string' ? work.description
    : isObject(work.description) && typeof work.description.value === 'string' ? work.description.value : null;
  const cover = Array.isArray(work.covers)
    ? work.covers.find((id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0) : undefined;
  const result: BookDetails = {
    workId,
    title: typeof work.title === 'string' && work.title.trim() ? work.title : summary?.title ?? 'Chưa có tên sách',
    authors: summary?.authors ?? [],
    coverUrl: cover ? `/api/covers/${cover}` : summary?.coverUrl ?? null,
    firstPublishYear: summary?.firstPublishYear ?? null,
    description,
    subjects: Array.isArray(work.subjects) ? work.subjects.filter((subject): subject is string => typeof subject === 'string') : [],
    suggestedTotalPages: edition ? edition.number_of_pages as number : null,
    suggestedEditionId: edition ? (edition.key as string).replace('/books/', '') : null,
  };
  if (detailsCache.size >= 100) detailsCache.delete(detailsCache.keys().next().value!);
  detailsCache.set(workId, { expiresAt: Date.now() + 5 * 60 * 1000, result });
  return result;
}
