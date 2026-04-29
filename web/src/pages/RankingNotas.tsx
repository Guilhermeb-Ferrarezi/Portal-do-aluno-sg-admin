import React from "react";
import { ChevronLeft, ChevronRight, GraduationCap, Search, Trophy } from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { AnimatedToast } from "../components/animate-ui";
import {
  getAvailableRankingPerCategoryPage,
  getRankingCategories,
  type CategoryRankingEntry,
  type RankingCategory,
} from "../services/api";

const cardClass =
  "rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";

const tabsClass =
  "inline-flex max-w-full flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-card/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

const tabClass = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
    active
      ? "bg-primary text-primary-foreground shadow"
      : "text-muted-foreground hover:text-foreground hover:bg-accent"
  }`;

const PAGE_SIZE = 20;
const CATEGORY_PAGE_SIZE = 8;

function dedupeRankings(rows: CategoryRankingEntry[]) {
  const seen = new Set<number>();
  return rows.filter((row) => {
    if (seen.has(row.userId)) return false;
    seen.add(row.userId);
    return true;
  });
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-border/60"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {initials || "?"}
    </div>
  );
}

function StatusBadge({ status }: { status: CategoryRankingEntry["status"] }) {
  const map = {
    Desbloqueado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "Em Progresso": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "Não Iniciado": "bg-muted text-muted-foreground",
  } as const;
  const cls = status ? map[status] : map["Não Iniciado"];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {status ?? "Não Iniciado"}
    </span>
  );
}

function PositionCell({ index }: { index: number }) {
  const pos = index + 1;
  if (pos === 1)
    return (
      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
        <Trophy size={14} /> 1
      </span>
    );
  if (pos === 2) return <span className="font-bold text-slate-400">2</span>;
  if (pos === 3) return <span className="font-bold text-orange-500">3</span>;
  return <span className="text-muted-foreground">{pos}</span>;
}

export default function RankingNotasPage() {
  const [categories, setCategories] = React.useState<RankingCategory[] | null>(null);
  const [rankings, setRankings] = React.useState<CategoryRankingEntry[]>([]);
  const [totalRows, setTotalRows] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [categoryPage, setCategoryPage] = React.useState(1);
  const [loadingCategory, setLoadingCategory] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const loadingMoreRef = React.useRef(false);
  const requestedPagesRef = React.useRef(new Set<string>());
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getRankingCategories()
      .then((res) => {
        if (cancelled) return;
        setCategories(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar categorias");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCategories = React.useMemo(() => {
    if (!categories) return [];
    const term = categorySearch.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((cat) =>
      cat.category.toLowerCase().includes(term)
    );
  }, [categories, categorySearch]);

  const categoryPageCount = Math.max(
    1,
    Math.ceil(filteredCategories.length / CATEGORY_PAGE_SIZE)
  );
  const visibleCategories = filteredCategories.slice(
    (categoryPage - 1) * CATEGORY_PAGE_SIZE,
    categoryPage * CATEGORY_PAGE_SIZE
  );

  React.useEffect(() => {
    setCategoryPage(1);
  }, [categorySearch]);

  React.useEffect(() => {
    if (categoryPage > categoryPageCount) setCategoryPage(categoryPageCount);
  }, [categoryPage, categoryPageCount]);

  const hasMore = activeCategory !== null && totalRows !== null && rankings.length < totalRows;

  const loadCategory = React.useCallback(
    async (category: string, options: { append?: boolean } = {}) => {
      const append = options.append === true;
      const offset = append ? rankings.length : 0;
      const requestKey = `${category}:${offset}`;

      if (append) {
        if (
          loadingCategory ||
          loadingMoreRef.current ||
          rankings.length === 0 ||
          (totalRows !== null && rankings.length >= totalRows) ||
          requestedPagesRef.current.has(requestKey)
        ) {
          return;
        }
        loadingMoreRef.current = true;
        requestedPagesRef.current.add(requestKey);
        setLoadingMore(true);
      } else {
        requestedPagesRef.current = new Set([requestKey]);
        setActiveCategory(category);
        setRankings([]);
        setTotalRows(null);
        setLoadingCategory(true);
      }

      try {
        const page = await getAvailableRankingPerCategoryPage({
          category,
          limit: PAGE_SIZE,
          offset,
        });
        const categoryPage = page.items[0];
        const nextRows = dedupeRankings(categoryPage?.rankings ?? []);
        setRankings((prev) =>
          append ? dedupeRankings([...prev, ...nextRows]) : nextRows
        );
        setTotalRows(page.totalRows ?? nextRows.length);
      } catch (err) {
        requestedPagesRef.current.delete(requestKey);
        setError(err instanceof Error ? err.message : "Erro ao carregar ranking");
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoadingCategory(false);
        }
      }
    },
    [loadingCategory, rankings.length, totalRows]
  );

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !activeCategory) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadCategory(activeCategory, { append: true });
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeCategory, loadCategory]);

  return (
    <DashboardLayout
      title="Ranking de Notas"
      subtitle="Alunos com 10+ respostas concorrem às premiações de cada categoria."
    >
      <AnimatedToast
        message={error}
        type="error"
        onClose={() => setError(null)}
      />
      <div className="flex flex-col gap-6">
        {categories === null ? (
          <div className={`${cardClass} animate-pulse text-sm text-muted-foreground`}>
            Carregando categorias...
          </div>
        ) : categories.length === 0 ? (
          <div className={`${cardClass} flex items-center gap-3 text-sm text-muted-foreground`}>
            <GraduationCap size={20} />
            Nenhuma categoria disponível para ranking ainda.
          </div>
        ) : (
          <>
            <div className={`${cardClass} flex flex-col gap-4`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex h-11 w-full max-w-md items-center gap-3 rounded-2xl border border-border/75 bg-card px-4 text-sm transition hover:border-primary/35 focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/30">
                  <Search
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                  <input
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/90"
                    placeholder="Filtrar categoria"
                    data-testid="categoria-search"
                  />
                </label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-muted/45 text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}
                    disabled={categoryPage <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    {categoryPage} / {categoryPageCount}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-muted/45 text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() =>
                      setCategoryPage((page) => Math.min(categoryPageCount, page + 1))
                    }
                    disabled={categoryPage >= categoryPageCount}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {visibleCategories.length > 0 ? (
                <div className={tabsClass} role="tablist" data-testid="categoria-tabs">
                  {visibleCategories.map((cat) => (
                    <button
                      key={cat.id}
                      role="tab"
                      aria-selected={activeCategory === cat.category}
                      className={tabClass(activeCategory === cat.category)}
                      onClick={() => void loadCategory(cat.category)}
                      data-testid={`categoria-tab-${cat.category}`}
                    >
                      {cat.category}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Nenhuma categoria encontrada.
                </div>
              )}
            </div>

            <div className={cardClass}>
              {!activeCategory ? (
                <div className="text-sm text-muted-foreground">
                  Selecione uma categoria para carregar o ranking de notas.
                </div>
              ) : loadingCategory ? (
                <div className="animate-pulse text-sm text-muted-foreground">
                  Carregando ranking...
                </div>
              ) : rankings.length > 0 ? (
                <table
                  className="w-full text-sm"
                  data-testid="ranking-notas-table"
                >
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="w-12 px-2 py-3">#</th>
                      <th className="px-2 py-3">Aluno</th>
                      <th className="w-28 px-2 py-3 text-right">% Acerto</th>
                      <th className="w-28 px-2 py-3 text-right">Respostas</th>
                      <th className="w-40 px-2 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((entry, idx) => (
                      <tr
                        key={entry.userId}
                        className="border-t border-border/60"
                      >
                        <td className="px-2 py-3">
                          <PositionCell index={idx} />
                        </td>
                        <td className="flex items-center gap-3 px-2 py-3">
                          <Avatar
                            src={entry.profilePictureUrl}
                            name={entry.name}
                          />
                          <span className="font-medium text-foreground">
                            {entry.name}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-foreground">
                          {entry.percentAvailable.toFixed(1)}%
                        </td>
                        <td className="px-2 py-3 text-right text-muted-foreground">
                          {entry.totalAnswers}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <StatusBadge status={entry.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Sem alunos nessa categoria ainda.
                </div>
              )}
              {activeCategory && hasMore ? <div ref={sentinelRef} className="h-1" /> : null}
              {loadingMore ? (
                <div className="pt-4 text-center text-sm text-muted-foreground">
                  Carregando mais alunos...
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
