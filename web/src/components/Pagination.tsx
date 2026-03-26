import { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PaginationProps {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export default function Pagination({
  currentPage,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const itemsPerPageId = useId();
  const jumpToPageId = useId();
  const allowedPageSizes = [5, 10, 20, 50] as const;
  const normalizeItemsPerPage = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return allowedPageSizes[0];
    if (allowedPageSizes.includes(value as (typeof allowedPageSizes)[number])) return value;
    if (value >= 50) return 50;
    if (value >= 20) return 20;
    if (value >= 10) return 10;
    return 5;
  };

  const safeItemsPerPage = normalizeItemsPerPage(itemsPerPage);
  const safeTotalItems = Number.isFinite(totalItems) && totalItems > 0 ? Math.floor(totalItems) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safeItemsPerPage));
  const safeCurrentPage = Number.isFinite(currentPage)
    ? Math.min(Math.max(Math.floor(currentPage), 1), totalPages)
    : 1;
  const [jumpPage, setJumpPage] = useState(String(safeCurrentPage));

  useEffect(() => {
    if (itemsPerPage !== safeItemsPerPage) {
      onItemsPerPageChange(safeItemsPerPage);
    }
  }, [itemsPerPage, onItemsPerPageChange, safeItemsPerPage]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      onPageChange(safeCurrentPage);
    }
  }, [currentPage, onPageChange, safeCurrentPage]);

  useEffect(() => {
    setJumpPage(String(safeCurrentPage));
  }, [safeCurrentPage]);

  useEffect(() => {
    const value = jumpPage.trim();
    if (!value) return;

    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return;

    const nextPage = Math.min(Math.max(parsed, 1), totalPages);
    if (nextPage === safeCurrentPage) return;

    const timer = window.setTimeout(() => {
      onPageChange(nextPage);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [jumpPage, onPageChange, safeCurrentPage, totalPages]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 3) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.min(safeCurrentPage, totalPages - 2);
    return [start, start + 1, start + 2];
  }, [safeCurrentPage, totalPages]);

  if (safeTotalItems === 0) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex w-full items-center justify-start">
        <span className="text-sm font-medium text-muted-foreground">
          Exibindo {Math.min((safeCurrentPage - 1) * safeItemsPerPage + 1, safeTotalItems)} a{" "}
          {Math.min(safeCurrentPage * safeItemsPerPage, safeTotalItems)} de {safeTotalItems} itens
        </span>
      </div>

      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:justify-between md:gap-3">
        <div className="flex items-center gap-2.5">
          <label htmlFor={itemsPerPageId} className="text-sm font-medium text-muted-foreground">
            Itens por pagina:
          </label>
          <select
            id={itemsPerPageId}
            value={safeItemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(normalizeItemsPerPage(parseInt(e.target.value, 10)));
              onPageChange(1);
            }}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition hover:border-border/80 hover:bg-muted/40 focus:border-primary focus:ring-3 focus:ring-ring/30"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-1 rounded-full border border-border/70 bg-muted/65 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            className="rounded-full px-3.5 font-bold"
            title="Pagina anterior"
          >
            <ChevronLeft size={16} /> Anterior
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-1">
            {visiblePages.map((page) => (
              <Button
                type="button"
                key={page}
                onClick={() => onPageChange(page)}
                variant={page === safeCurrentPage ? "default" : "ghost"}
                size="sm"
                className="min-w-9 rounded-full px-3 font-bold"
                aria-current={page === safeCurrentPage ? "page" : undefined}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            className="rounded-full px-3.5 font-bold"
            title="Proxima pagina"
          >
            Proxima <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 md:justify-end">
          <label htmlFor={jumpToPageId} className="text-sm font-semibold text-muted-foreground">
            Pagina:
          </label>
          <Input
            id={jumpToPageId}
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            className="h-10 w-[72px] rounded-full border-border bg-card px-3 text-center text-sm font-medium text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
