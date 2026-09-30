export type ReadingStatus = 'want_to_read' | 'reading' | 'completed'
export interface Book {
  id: string // Open Library Work ID; khác ID mục tủ.
  title: string
  author: string
  year: number | null
  pages: number | null
  coverUrl: string | null
  description: string
  subjects: string[]
  inShelf: boolean
  suggestedEditionId?: string | null
}
export interface ShelfEntry {
  id: string
  bookId: string
  status: ReadingStatus
  totalPages: number
  currentPage: number
  rating: number | null
  notes: string
  startedAt: string | null
  finishedAt: string | null
}
export interface ShelfBook extends Book { entry: ShelfEntry }
export interface ApiBook {
  workId: string
  title: string
  authors: string[]
  firstPublishYear: number | null
  coverUrl: string | null
  inShelf?: boolean
  description?: string | null
  subjects?: string[]
  suggestedTotalPages?: number | null
  suggestedEditionId?: string | null
}
export interface ApiShelfBook extends ApiBook {
  id: string
  bookId: string
  status: ReadingStatus
  totalPages: number
  currentPage: number
  rating: number | null
  notes: string | null
  startedAt: string | null
  finishedAt: string | null
}
export interface ShelfPatch {
  status?: ReadingStatus
  currentPage?: number
  rating?: number | null
  notes?: string | null
}
export const statusLabels: Record<ReadingStatus, string> = {
  want_to_read: 'Muốn đọc', reading: 'Đang đọc', completed: 'Đã đọc',
}
