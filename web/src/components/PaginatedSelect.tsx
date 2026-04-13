import React from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { cn } from "../lib/utils";

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

const triggerClass =
  "flex w-full items-start gap-2 rounded-2xl border-2 border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 md:min-h-12 md:items-center";
const panelClass =
  "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] flex max-h-[min(420px,65vh)] flex-col gap-2 overflow-hidden rounded-2xl border-2 border-border bg-card p-2.5 shadow-lg md:max-h-[min(420px,65vh)]";
const panelSearchClass =
  "flex items-center gap-2 rounded-xl border-2 border-border bg-muted/40 px-3 py-2 text-muted-foreground";
const optionClass =
  "flex w-full flex-col gap-1 rounded-xl border-2 border-border bg-card px-3 py-2.5 text-left text-sm text-foreground transition duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md";
const navButtonClass =
  "inline-flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm text-foreground transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50";
const pageSizeSelectClass =
  "h-9 min-w-[72px] rounded-xl border-2 border-border bg-card px-2.5 text-sm text-foreground outline-none transition focus:border-primary/35";

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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selected = React.useMemo(
    () => selectedOption ?? (options.find((opt) => opt.value === value) || null),
    [options, selectedOption, value],
  );

  function cleanDisplayText(text: string | undefined) {
    if (!text) return "";
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
      <div
      ref={rootRef}
      className={cn("relative z-[2] w-full", open && "z-[120]")}
    >
      <button
        type="button"
        className={cn(triggerClass, !selected && "text-muted-foreground font-medium tracking-[0.01em]")}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="overflow-hidden text-left whitespace-normal break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] md:block md:truncate">
            {selected ? cleanDisplayText(selected.label) : cleanDisplayText(placeholder)}
          </span>
          {selected?.meta ? (
            <small className="[overflow-wrap:anywhere] text-left text-[11px] font-bold uppercase tracking-[0.03em] text-primary">
              {cleanDisplayText(selected.meta)}
            </small>
          ) : null}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "mt-1 shrink-0 text-primary transition duration-200 md:mt-0",
            open && "rotate-180 text-foreground",
          )}
        />
      </button>

      {open && !disabled ? (
        <div className={panelClass}>
          <div className={panelSearchClass}>
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <input
              value={currentQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Buscar..."
              className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {currentQuery ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="inline-flex size-6 items-center justify-center rounded-full border border-border/60 bg-background/40 text-muted-foreground transition hover:border-primary/35 hover:bg-muted/60 hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>

          <div className="flex max-h-[300px] flex-col gap-1.5 overflow-auto pr-1">
            {remote?.loading ? (
              <div
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground"
              >
                <Loader2 size={14} className="animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : paged.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              paged.map((opt) => {
                const isActive = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      optionClass,
                      isActive &&
                        "border-primary/60 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(var(--primary-rgb),0.24)]",
                    )}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 items-start justify-between gap-2.5">
                      <span className="min-w-0 font-mono font-semibold [overflow-wrap:anywhere]">
                        {cleanDisplayText(opt.label)}
                      </span>
                      {isActive ? <Check size={14} className="shrink-0 text-primary" /> : null}
                    </span>
                    {opt.meta ? (
                      <small className="[overflow-wrap:anywhere] text-[11px] text-muted-foreground">
                        {cleanDisplayText(opt.meta)}
                      </small>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
            {allowPageSizeChange ? (
              <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start">
                <label
                  htmlFor={pageSizeId}
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                >
                  Qtd
                </label>
                <select
                  id={pageSizeId}
                  value={String(safePageSize)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setCurrentPageSize(Number.isFinite(next) && next > 0 ? next : pageSize);
                    setPage(1);
                  }}
                  className={pageSizeSelectClass}
                >
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex w-full items-center justify-between gap-2 md:ml-auto md:w-auto md:justify-start">
              <button
                type="button"
                className={navButtonClass}
                onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft size={14} />
                Ant
              </button>
              <span className="text-sm text-muted-foreground">
                {safePage}/{totalPages}
              </span>
              <button
                type="button"
                className={navButtonClass}
                onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
              >
                Prox
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
