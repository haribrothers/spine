"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 25;

/**
 * Client-side pagination over an already-fetched, already-filtered array —
 * Contacts and Catalogue both load their full filtered list in one request
 * (see contacts-explorer.tsx / catalog-explorer.tsx) rather than paging
 * server-side, so slicing happens here instead of in an API query.
 * Resets to page 1 whenever the source array or page size changes, so a
 * filter change or a page-size change never strands the view on a page
 * that no longer exists.
 */
export function usePagination<T>(rows: T[] | null, defaultPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  const total = rows?.length ?? 0;
  const pageRows = useMemo(() => {
    if (!rows) return null;
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  return { page, pageSize, total, pageRows, setPage, setPageSize };
}
