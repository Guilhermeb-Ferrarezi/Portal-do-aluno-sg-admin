import { useEffect, useMemo, useState } from "react";
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
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const [jumpPage, setJumpPage] = useState(String(currentPage));

  useEffect(() => {
    setJumpPage(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const value = jumpPage.trim();
    if (!value) return;

    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return;

    const nextPage = Math.min(Math.max(parsed, 1), totalPages);
    if (nextPage === currentPage) return;

    const timer = window.setTimeout(() => {
      onPageChange(nextPage);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [jumpPage, currentPage, totalPages, onPageChange]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 3) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.min(currentPage, totalPages - 2);
    return [start, start + 1, start + 2];
  }, [currentPage, totalPages]);

  if (totalItems === 0) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex w-full items-center justify-start">
        <span className="text-sm font-medium text-muted-foreground">
          Exibindo {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} itens
        </span>
      </div>

      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:justify-between md:gap-3">
        <div className="flex items-center gap-2.5">
          <label htmlFor="itemsPerPage" className="text-sm font-medium text-muted-foreground">
            Itens por pagina:
          </label>
          <select
            id="itemsPerPage"
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(parseInt(e.target.value, 10));
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
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
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
                variant={page === currentPage ? "default" : "ghost"}
                size="sm"
                className="min-w-9 rounded-full px-3 font-bold"
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="rounded-full px-3.5 font-bold"
            title="Proxima pagina"
          >
            Proxima <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 md:justify-end">
          <label htmlFor="jumpToPage" className="text-sm font-semibold text-muted-foreground">
            Pagina:
          </label>
          <Input
            id="jumpToPage"
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
