import React from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
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
  pageSizeOptions?: number[];
  allowPageSizeChange?: boolean;
  emptyText?: string;
};

export default function PaginatedSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  disabled = false,
  pageSize = 6,
  pageSizeOptions = [5, 10, 20, 30],
  allowPageSizeChange = true,
  emptyText = "Nenhuma opcao encontrada",
}: PaginatedSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [currentPageSize, setCurrentPageSize] = React.useState(pageSize);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const pageSizeId = React.useId();

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

  function cleanDisplayText(text: string | undefined) {
    if (!text) return "";
    // Remove replacement-char artifacts from malformed source text.
    const replacementChar = String.fromCharCode(65533);
    return text.split(replacementChar).join("").trim();
  }

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((opt) => {
      const meta = (opt.meta || "").toLowerCase();
      return opt.label.toLowerCase().includes(normalized) || meta.includes(normalized);
    });
  }, [options, query]);

  React.useEffect(() => {
    setCurrentPageSize(pageSize);
  }, [pageSize]);

  const safePageSize = Math.max(1, currentPageSize || 1);
  const sizeOptions = React.useMemo(() => {
    const merged = [pageSize, ...pageSizeOptions]
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Array.from(new Set(merged)).sort((a, b) => a - b);
  }, [pageSize, pageSizeOptions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize);

  React.useEffect(() => {
    setPage(1);
  }, [query, options.length, safePageSize]);

  return (
    <div className={`paginatedSelect ${disabled ? "isDisabled" : ""} ${!selected ? "isPlaceholder" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="paginatedSelectTrigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="paginatedSelectValueWrap">
          <span className="paginatedSelectValue">
            {selected ? cleanDisplayText(selected.label) : cleanDisplayText(placeholder)}
          </span>
          {selected?.meta ? <small className="paginatedSelectValueMeta">{cleanDisplayText(selected.meta)}</small> : null}
        </span>
        <ChevronDown size={16} className={`paginatedSelectChevron ${open ? "isOpen" : ""}`} />
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
                  <span className="paginatedSelectOptionMain">
                    <span>{cleanDisplayText(opt.label)}</span>
                    {value === opt.value ? <Check size={14} className="paginatedSelectOptionCheck" /> : null}
                  </span>
                  {opt.meta ? <small>{cleanDisplayText(opt.meta)}</small> : null}
                </button>
              ))
            )}
          </div>

          <div className="paginatedSelectFooter">
            {allowPageSizeChange ? (
              <div className="paginatedPageSize">
                <label htmlFor={pageSizeId}>Qtd</label>
                <select
                  id={pageSizeId}
                  value={String(safePageSize)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setCurrentPageSize(Number.isFinite(next) && next > 0 ? next : pageSize);
                    setPage(1);
                  }}
                >
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="paginatedPager">
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
        </div>
      )}
    </div>
  );
}
