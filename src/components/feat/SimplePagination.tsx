import { useMemo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";

export function SimplePagination({
  skip,
  count,
  setSkip,
  limit,
}: {
  skip: number;
  count: number;
  setSkip: (skip: number) => void;
  limit: number;
}) {
  const paginationState = useMemo(() => {
    const canGoPrev = skip > 0;
    const canGoNext = skip + 10 <= count;

    return {
      canGoPrev,
      canGoNext,
    };
  }, [count, skip]);

  function goPrevPage() {
    if (skip <= 0) {
      return;
    }

    setSkip(skip - limit);
  }

  function goNextPage() {
    const nextSkip = skip + limit;
    if (nextSkip > count) {
      return;
    }
    setSkip(nextSkip);
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={goPrevPage}
            className={`${paginationState.canGoPrev ? "" : "pointer-events-none opacity-40"}`}
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            onClick={goNextPage}
            className={`${paginationState.canGoNext ? "" : "pointer-events-none opacity-40"}`}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
