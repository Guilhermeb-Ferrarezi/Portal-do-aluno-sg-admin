import React from "react";
import { useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import {
  Search,
  ArrowRight,
  CornerDownLeft,
  Command as CommandIcon,
  Clock,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  group: string;
  keywords?: string[];
  to?: string;
  onSelect?: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  currentPath?: string;
};

const RECENT_KEY = "command-palette-recents";
const PINNED_KEY = "command-palette-pinned";
const RECENT_LIMIT = 5;

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveRecents(ids: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT)));
  } catch {
    // ignore
  }
}

function loadPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function savePinned(ids: string[]) {
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  const q = normalize(query);
  const t = normalize(target);
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  const idx = t.indexOf(q);
  if (idx !== -1) return 600 - idx;
  let ti = 0;
  let matched = 0;
  let lastMatch = -1;
  let consecutive = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) {
        found = j;
        break;
      }
    }
    if (found === -1) return 0;
    matched++;
    if (lastMatch !== -1 && found === lastMatch + 1) consecutive++;
    lastMatch = found;
    ti = found + 1;
  }
  return matched * 10 + consecutive * 20;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = normalize(query);
  const t = normalize(text);
  const idx = t.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/20 px-0.5 text-primary">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function CommandPalette({ open, onOpenChange, items, currentPath }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recents, setRecents] = React.useState<string[]>(() => loadRecents());
  const [pinned, setPinned] = React.useState<string[]>(() => loadPinned());
  const [clearConfirming, setClearConfirming] = React.useState(false);
  const clearConfirmTimerRef = React.useRef<number | null>(null);

  const togglePin = React.useCallback((id: string) => {
    setPinned((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current];
      savePinned(next);
      return next;
    });
  }, []);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const itemIds = new Set(items.map((it) => it.id));
      const cleanedRecents = loadRecents().filter((id) => itemIds.has(id));
      const cleanedPinned = loadPinned().filter((id) => itemIds.has(id));
      saveRecents(cleanedRecents);
      savePinned(cleanedPinned);
      setRecents(cleanedRecents);
      setPinned(cleanedPinned);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, items]);

  const { effectiveQuery, modeLabel, scopedItems } = React.useMemo(() => {
    const raw = query.trim();
    if (raw.startsWith(">")) {
      return {
        effectiveQuery: raw.slice(1).trim(),
        modeLabel: "Apenas ações",
        scopedItems: items.filter((it) => it.group === "Ações"),
      };
    }
    if (raw.startsWith("#")) {
      return {
        effectiveQuery: raw.slice(1).trim(),
        modeLabel: "Apenas navegação",
        scopedItems: items.filter((it) => it.group !== "Ações"),
      };
    }
    if (raw.startsWith("@")) {
      return {
        effectiveQuery: raw.slice(1).trim(),
        modeLabel: "Apenas recentes",
        scopedItems: recents
          .map((id) => items.find((it) => it.id === id))
          .filter((it): it is CommandItem => !!it),
      };
    }
    return { effectiveQuery: raw, modeLabel: null as string | null, scopedItems: items };
  }, [items, query, recents]);

  const filtered = React.useMemo(() => {
    if (!effectiveQuery.trim()) {
      const recentItems = recents
        .map((id) => scopedItems.find((it) => it.id === id))
        .filter((it): it is CommandItem => !!it)
        .map((it) => ({ ...it, _isRecent: true }));
      const recentIds = new Set(recents);
      const rest = scopedItems.filter((it) => !recentIds.has(it.id));
      return [...recentItems, ...rest] as (CommandItem & { _isRecent?: boolean })[];
    }
    return scopedItems
      .map((it) => {
        const labelScore = fuzzyScore(effectiveQuery, it.label);
        const descScore = it.description ? fuzzyScore(effectiveQuery, it.description) * 0.5 : 0;
        const keywordScore = (it.keywords ?? []).reduce(
          (acc, k) => Math.max(acc, fuzzyScore(effectiveQuery, k) * 0.8),
          0
        );
        const groupScore = fuzzyScore(effectiveQuery, it.group) * 0.4;
        const score = Math.max(labelScore, descScore, keywordScore, groupScore);
        return { item: it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [scopedItems, effectiveQuery, recents]);

  const grouped = React.useMemo(() => {
    const groups = new Map<string, (CommandItem & { _isRecent?: boolean; _isPinned?: boolean })[]>();
    if (!effectiveQuery.trim()) {
      const list = filtered as (CommandItem & { _isRecent?: boolean; _isPinned?: boolean })[];
      const pinnedSet = new Set(pinned);
      const pinnedList = pinned
        .map((id) => list.find((it) => it.id === id))
        .filter((it): it is CommandItem => !!it)
        .map((it) => ({ ...it, _isPinned: true }));
      const recentList = list.filter((it) => it._isRecent && !pinnedSet.has(it.id));
      const rest = list.filter((it) => !it._isRecent && !pinnedSet.has(it.id));
      if (pinnedList.length > 0) groups.set("Favoritos", pinnedList);
      if (recentList.length > 0) groups.set("Recentes", recentList);
      for (const it of rest) {
        const arr = groups.get(it.group) ?? [];
        arr.push(it);
        groups.set(it.group, arr);
      }
    } else {
      for (const it of filtered) {
        const arr = groups.get(it.group) ?? [];
        arr.push(it);
        groups.set(it.group, arr);
      }
    }
    return Array.from(groups.entries());
  }, [filtered, effectiveQuery, pinned]);

  const flatList = React.useMemo(
    () => grouped.flatMap(([, list]) => list),
    [grouped]
  );

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const runItem = React.useCallback(
    (item: CommandItem) => {
      const next = [item.id, ...recents.filter((id) => id !== item.id)].slice(0, RECENT_LIMIT);
      setRecents(next);
      saveRecents(next);
      onOpenChange(false);
      if (item.onSelect) {
        item.onSelect();
      } else if (item.to) {
        navigate(item.to);
      }
    },
    [navigate, onOpenChange, recents]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "j")) {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatList.length - 1)));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(Math.max(0, flatList.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatList[activeIndex];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        onOpenChange(false);
      }
    } else if ((e.ctrlKey || e.altKey) && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = Number(e.key) - 1;
      const item = flatList[idx];
      if (item) runItem(item);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const item = flatList[activeIndex];
      if (item) togglePin(item.id);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          key="cp-overlay"
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Fechar busca"
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          />

          <m.div
            role="dialog"
            aria-label="Busca rápida"
            className={cn(
              "relative z-10 w-full max-w-[640px] overflow-hidden rounded-2xl border border-border/70",
              "bg-card text-foreground shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)]",
              "dark:bg-[linear-gradient(180deg,rgba(24,28,40,0.98),rgba(14,18,28,1))]"
            )}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
              <Search size={18} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={(e) => {
                  // Manter o foco no input enquanto o palette está aberto
                  if (open && e.currentTarget.isConnected) {
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }
                }}
                placeholder="Buscar páginas, ações, atalhos..."
                aria-label="Buscar páginas, ações, atalhos"
                className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              ) : null}
              <kbd className="hidden items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:inline-flex">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto px-2 py-2">
              {!effectiveQuery.trim() && pinned.length === 0 && recents.length === 0 ? (
                <div className="mx-2 mt-1 mb-1 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Star size={11} />
                    Dica: clique na estrela para fixar itens nos favoritos
                  </span>
                </div>
              ) : null}
              {grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="grid size-12 place-items-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
                    <Search size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Nenhum resultado</p>
                    <p className="text-xs text-muted-foreground">
                      Tente outras palavras-chave ou verifique a digitação.
                    </p>
                  </div>
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted"
                    >
                      Limpar busca
                    </button>
                  ) : null}
                </div>
              ) : (
                grouped.map(([group, list]) => {
                  const isRecent = group === "Recentes";
                  const isPinnedGroup = group === "Favoritos";
                  return (
                    <div key={group} className="px-1 pt-2 first:pt-1">
                      <div className="flex items-center justify-between gap-2 px-2 pb-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
                          {isRecent ? <Clock size={11} /> : null}
                          {isPinnedGroup ? <Star size={11} className="fill-current" /> : null}
                          {group}
                        </div>
                        {isRecent && recents.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (clearConfirming) {
                                setRecents([]);
                                saveRecents([]);
                                setClearConfirming(false);
                                if (clearConfirmTimerRef.current) {
                                  window.clearTimeout(clearConfirmTimerRef.current);
                                }
                              } else {
                                setClearConfirming(true);
                                if (clearConfirmTimerRef.current) {
                                  window.clearTimeout(clearConfirmTimerRef.current);
                                }
                                clearConfirmTimerRef.current = window.setTimeout(() => {
                                  setClearConfirming(false);
                                }, 2200);
                              }
                            }}
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider transition",
                              clearConfirming
                                ? "text-red-400 hover:text-red-300"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {clearConfirming ? "Confirmar?" : "Limpar"}
                          </button>
                        ) : null}
                      </div>
                      <div className="grid gap-0.5">
                        {list.map((item) => {
                          const flatIdx = flatList.indexOf(item);
                          const active = flatIdx === activeIndex;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-cmd-index={flatIdx}
                              onMouseMove={() => setActiveIndex(flatIdx)}
                              onClick={() => runItem(item)}
                              className={cn(
                                "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                                active
                                  ? "bg-primary/10 text-foreground"
                                  : "text-foreground/90 hover:bg-muted/50"
                              )}
                            >
                              <span
                                className={cn(
                                  "grid size-8 shrink-0 place-items-center rounded-lg border transition-colors",
                                  active
                                    ? "border-primary/30 bg-primary/15 text-primary"
                                    : "border-border/60 bg-muted/40 text-muted-foreground"
                                )}
                              >
                                <item.icon size={15} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold">
                                    {highlightMatch(item.label, effectiveQuery)}
                                  </span>
                                  {currentPath && item.to === currentPath ? (
                                    <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-primary">
                                      Atual
                                    </span>
                                  ) : null}
                                </span>
                                {item.description ? (
                                  <span className="block truncate text-[12px] text-muted-foreground">
                                    {highlightMatch(item.description, effectiveQuery)}
                                  </span>
                                ) : null}
                              </span>
                              {flatIdx < 5 && !active ? (
                                <kbd className="hidden shrink-0 items-center rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline-flex">
                                  {flatIdx + 1}
                                </kbd>
                              ) : null}
                              <span
                                role="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(item.id);
                                }}
                                className={cn(
                                  "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition",
                                  pinned.includes(item.id)
                                    ? "text-amber-400 hover:text-amber-300"
                                    : active
                                    ? "text-muted-foreground opacity-100 hover:text-foreground"
                                    : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                                )}
                                aria-label={pinned.includes(item.id) ? "Desafixar" : "Fixar nos favoritos"}
                                title={pinned.includes(item.id) ? "Desafixar" : "Fixar nos favoritos"}
                              >
                                <Star
                                  size={12}
                                  className={pinned.includes(item.id) ? "fill-current" : undefined}
                                />
                              </span>
                              <ArrowRight
                                size={14}
                                className={cn(
                                  "shrink-0 transition-opacity",
                                  active ? "opacity-100 text-primary" : "opacity-0"
                                )}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="inline-flex items-center rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px]">
                    ↑↓
                  </kbd>
                  navegar
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="inline-flex items-center rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px]">
                    <CornerDownLeft size={10} />
                  </kbd>
                  abrir
                </span>
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <kbd className="inline-flex items-center rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px]">
                    Ctrl D
                  </kbd>
                  fixar
                </span>
                {flatList.length > 0 ? (
                  <span className="hidden text-[10px] font-bold text-muted-foreground/70 sm:inline">
                    {flatList.length} resultado{flatList.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-1 md:inline-flex">
                  <kbd className="inline-flex items-center rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px]">
                    ?
                  </kbd>
                  ajuda
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CommandIcon size={11} />
                  {modeLabel ?? "Busca inteligente"}
                </span>
              </div>
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
