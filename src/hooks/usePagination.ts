import { useMemo, useState } from 'react';

export interface PaginationState<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  pageItems: T[];
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePagination<T>(items: T[], pageSize = 20): PaginationState<T> {
  const [page, setPageRaw] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize],
  );

  const setPage = (next: number) => {
    setPageRaw(Math.min(Math.max(1, next), totalPages));
  };

  return {
    page: clampedPage,
    pageSize,
    totalPages,
    pageItems,
    setPage,
    nextPage: () => setPage(clampedPage + 1),
    prevPage: () => setPage(clampedPage - 1),
  };
}
