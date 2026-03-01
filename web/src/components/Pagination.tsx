import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./Pagination.css";

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
    <div className="paginationContainer">
      <div className="paginationInfo">
        <span className="paginationText">
          Exibindo {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} itens
        </span>
      </div>

      <div className="paginationControls">
        <div className="itemsPerPageSelector">
          <label htmlFor="itemsPerPage">Itens por página:</label>
          <select
            id="itemsPerPage"
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(parseInt(e.target.value));
              onPageChange(1);
            }}
            className="itemsPerPageSelect"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="paginationButtons">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="paginationBtn"
            title="Página anterior"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <div className="pageIndicator">
            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`pageNumber ${page === currentPage ? "active" : ""}`}
                disabled={page === currentPage}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="paginationBtn"
            title="Próxima página"
          >
            Próxima <ChevronRight size={16} />
          </button>
        </div>

        <div className="pageJump">
          <label htmlFor="jumpToPage">Página:</label>
          <input
            id="jumpToPage"
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            className="pageJumpInput"
          />
        </div>
      </div>
    </div>
  );
}
