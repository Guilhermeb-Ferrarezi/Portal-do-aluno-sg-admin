import React from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import "./PaginatedSelect.css";

export type PaginatedSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type PaginatedSelectRemoteConfig = {
  query: string;
  onQueryChange: (value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
};

type PaginatedSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: PaginatedSelectOption[];
  selectedOption?: PaginatedSelectOption | null;
  placeholder?: string;
  disabled?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  allowPageSizeChange?: boolean;
  emptyText?: string;
  remote?: PaginatedSelectRemoteConfig;
};

export default function PaginatedSelect({
  value,
  onChange,
  options,
  selectedOption,
  placeholder = "Selecionar",
  disabled = false,
  pageSize = 6,
  pageSizeOptions = [5, 10, 20, 30],
  allowPageSizeChange = true,
  emptyText = "Nenhuma opcao encontrada",
  remote,
}: PaginatedSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [currentPageSize, setCurrentPageSize] = React.useState(pageSize);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const pageSizeId = React.useId();
  const isRemote = !!remote;

  const currentQuery = isRemote ? remote.query : query;
  const currentPage = isRemote ? remote.page : page;

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
    () => selectedOption ?? (options.find((opt) => opt.value === value) || null),
    [options, selectedOption, value]
  );

  function cleanDisplayText(text: string | undefined) {
    if (!text) return "";
    // Remove replacement-char artifacts from malformed source text.
    const replacementChar = String.fromCharCode(65533);
    return text.split(replacementChar).join("").trim();
  }

  const filtered = React.useMemo(() => {
    if (isRemote) return options;

    const normalized = currentQuery.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((opt) => {
      const meta = (opt.meta || "").toLowerCase();
      return opt.label.toLowerCase().includes(normalized) || meta.includes(normalized);
    });
  }, [currentQuery, isRemote, options]);

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

  const totalPages = isRemote
    ? Math.max(1, remote.totalPages || 1)
    : Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = isRemote
    ? filtered
    : filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize);

  React.useEffect(() => {
    if (isRemote) return;
    setPage(1);
  }, [currentQuery, isRemote, options.length, safePageSize]);

  function handleQueryChange(next: string) {
    if (isRemote) {
      remote.onQueryChange(next);
      if (remote.page !== 1) {
        remote.onPageChange(1);
      }
      return;
    }
    setQuery(next);
  }

  function handlePageChange(next: number) {
    if (isRemote) {
      remote.onPageChange(next);
      return;
    }
    setPage(next);
  }

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
              value={currentQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Buscar..."
            />
            {currentQuery && (
              <button type="button" onClick={() => handleQueryChange("")} className="clearQueryBtn" aria-label="Limpar busca">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="paginatedSelectList">
            {remote?.loading ? (
              <div className="paginatedSelectLoading" role="status" aria-live="polite">
                <Loader2 size={14} className="paginatedSelectLoadingIcon" />
                <span>Carregando...</span>
              </div>
            ) : paged.length === 0 ? (
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
                onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft size={14} /> Ant
              </button>
              <span className="pageInfo">{safePage}/{totalPages}</span>
              <button
                type="button"
                className="paginatedNavBtn"
                onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
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
