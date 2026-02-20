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
            ← Anterior
          </button>

          <div className="pageIndicator">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
