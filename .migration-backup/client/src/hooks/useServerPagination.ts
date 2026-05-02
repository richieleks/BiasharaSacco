import { useState, useCallback } from 'react';

interface UseServerPaginationOptions {
  initialPage?: number;
  initialLimit?: number;
}

export function useServerPagination({ initialPage = 1, initialLimit = 10 }: UseServerPaginationOptions = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState('');

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  }, []);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) params.set('search', search);
    return params.toString();
  }, [page, limit, search]);

  return {
    page,
    limit,
    search,
    setPage: handlePageChange,
    setLimit: handleLimitChange,
    setSearch: handleSearchChange,
    buildQueryParams,
  };
}
