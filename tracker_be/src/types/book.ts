export interface SearchBook {
  workId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
}

export interface BookSearchResult {
  items: SearchBook[];
  total: number;
}

export interface BookDetails extends SearchBook {
  description: string | null;
  subjects: string[];
  suggestedTotalPages: number | null;
  suggestedEditionId: string | null;
}

export interface SavedBookDetails extends BookDetails {
  inShelf: boolean;
}
