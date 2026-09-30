import type { SearchBook } from './book';

export type ReadingStatus = 'want_to_read' | 'reading' | 'completed';
export interface AddShelfInput {
  workId: string;
  status: ReadingStatus;
  totalPages: number;
}
export interface PatchShelfInput {
  status?: ReadingStatus;
  currentPage?: number;
  rating?: number | null;
  notes?: string | null;
}
export interface ShelfItem extends SearchBook {
  id: string;
  bookId: string;
  description: string | null;
  subjects: string[];
  status: ReadingStatus;
  totalPages: number;
  currentPage: number;
  progressPercent: number;
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
