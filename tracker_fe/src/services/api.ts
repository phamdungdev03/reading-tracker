import type { ApiBook, ApiShelfBook, Book, ReadingStatus, ShelfBook, ShelfPatch } from '@/types/book'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  const timeout = setTimeout(() => controller.abort(), 90000)
  try {
    const response = await fetch(`/api${path}`, {
      ...options, signal: controller.signal,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
    if (response.status === 204) return undefined as T
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const fields = body?.error?.fields as Record<string, string> | undefined
      throw new ApiError(response.status, fields ? Object.values(fields).join(' ') : body?.error?.message ?? 'Không thể xử lý yêu cầu. Vui lòng thử lại.')
    }
    if (!body || !('data' in body)) throw new Error('Phản hồi từ máy chủ không hợp lệ.')
    return body as T
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (error instanceof ApiError) throw error
    throw new Error(controller.signal.aborted ? 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.' : 'Không kết nối được máy chủ. Vui lòng thử lại.')
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
function mapBook(book: ApiBook): Book {
  return {
    id: book.workId, title: book.title, author: book.authors.join(', ') || 'Chưa rõ tác giả',
    year: book.firstPublishYear, pages: book.suggestedTotalPages ?? null,
    coverUrl: book.coverUrl, description: book.description || 'Chưa có mô tả cho cuốn sách này.',
    subjects: book.subjects ?? [], inShelf: book.inShelf ?? false,
    suggestedEditionId: book.suggestedEditionId,
  }
}
function mapShelf(book: ApiShelfBook): ShelfBook {
  return { ...mapBook(book), pages: book.totalPages, inShelf: true, entry: {
    id: book.id, bookId: book.bookId, status: book.status, totalPages: book.totalPages,
    currentPage: book.currentPage, rating: book.rating, notes: book.notes ?? '',
    startedAt: book.startedAt, finishedAt: book.finishedAt,
  } }
}
export const api = {
  async search(q: string, page: number, signal: AbortSignal) {
    const result = await request<{ data: ApiBook[]; pagination: { page: number; limit: number; total: number } }>(`/books?${new URLSearchParams({ q, page: String(page) })}`, { signal })
    return { books: result.data.map(mapBook), pagination: result.pagination }
  },
  async details(workId: string, signal: AbortSignal) {
    return mapBook((await request<{ data: ApiBook }>(`/books/${encodeURIComponent(workId)}`, { signal })).data)
  },
  async shelf() {
    const result = await request<{ data: { items: ApiShelfBook[] } }>('/shelf')
    return result.data.items.map(mapShelf)
  },
  async add(workId: string, totalPages: number, status: ReadingStatus) {
    return mapShelf((await request<{ data: ApiShelfBook }>('/shelf', { method: 'POST', body: JSON.stringify({ workId, totalPages, status }) })).data)
  },
  async update(id: string, patch: ShelfPatch) {
    return mapShelf((await request<{ data: ApiShelfBook }>(`/shelf/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })).data)
  },
  remove(id: string) { return request<void>(`/shelf/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
}
