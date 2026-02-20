import React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import "./PaginatedSelect.css";

export type PaginatedSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type PaginatedSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: PaginatedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  pageSize?: number;
  emptyText?: string;
};

export default function PaginatedSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  disabled = false,
  pageSize = 6,
  emptyText = "Nenhuma opcao encontrada",
}: PaginatedSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handleDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  const selected = React.useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((opt) => {
      const meta = (opt.meta || "").toLowerCase();
      return opt.label.toLowerCase().includes(normalized) || meta.includes(normalized);
    });
  }, [options, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [query, options.length, pageSize]);

  return (
    <div className={`paginatedSelect ${disabled ? "isDisabled" : ""} ${!selected ? "isPlaceholder" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="paginatedSelectTrigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="paginatedSelectValue">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} />
      </button>

      {open && !disabled && (
        <div className="paginatedSelectPanel">
          <div className="paginatedSelectSearch">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="clearQueryBtn" aria-label="Limpar busca">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="paginatedSelectList">
            {paged.length === 0 ? (
              <div className="paginatedSelectEmpty">{emptyText}</div>
            ) : (
              paged.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`paginatedSelectOption ${value === opt.value ? "active" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.meta ? <small>{opt.meta}</small> : null}
                </button>
              ))
            )}
          </div>

          <div className="paginatedSelectFooter">
            <button
              type="button"
              className="paginatedNavBtn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft size={14} /> Ant
            </button>
            <span className="pageInfo">{safePage}/{totalPages}</span>
            <button
              type="button"
              className="paginatedNavBtn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Prox <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
