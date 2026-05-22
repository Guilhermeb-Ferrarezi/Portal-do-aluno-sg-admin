import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { Keyboard, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ShortcutGroup = {
  title: string;
  items: { keys: string[]; label: string }[];
};

type HelpOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMac: boolean;
};

export default function HelpOverlay({ open, onOpenChange, isMac }: HelpOverlayProps) {
  const mod = isMac ? "⌘" : "Ctrl";
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const groups: ShortcutGroup[] = React.useMemo(
    () => [
      {
        title: "Geral",
        items: [
          { keys: [mod, "K"], label: "Abrir busca rápida" },
          { keys: ["/"], label: "Abrir busca rápida" },
          { keys: ["?"], label: "Abrir este painel de ajuda" },
          { keys: ["n"], label: "Abrir notificações (admin)" },
          { keys: ["i"], label: "Focar primeiro campo da página" },
          { keys: ["Esc"], label: "Fechar modais e overlays" },
        ],
      },
      {
        title: "Navegação (vim-style)",
        items: [
          { keys: ["g", "d"], label: "Ir para o Dashboard" },
          { keys: ["g", "t"], label: "Ir para Turmas" },
          { keys: ["g", "u"], label: "Ir para Usuários" },
          { keys: ["g", "e"], label: "Ir para Exercícios" },
          { keys: ["g", "m"], label: "Ir para Materiais" },
          { keys: ["g", "v"], label: "Ir para Videoaulas" },
          { keys: ["g", "n"], label: "Ir para página de Notificações" },
          { keys: ["g", "s"], label: "Ir para Sistema (Logs)" },
          { keys: ["g", "h"], label: "Abrir ajuda" },
        ],
      },
      {
        title: "Atalhos por área",
        items: [
          { keys: ["Alt", "1"], label: "Operação (Turmas)" },
          { keys: ["Alt", "2"], label: "Conteúdo (Exercícios)" },
          { keys: ["Alt", "3"], label: "Usuários" },
          { keys: ["Alt", "4"], label: "Sistema (Logs)" },
        ],
      },
      {
        title: "Dentro da busca",
        items: [
          { keys: ["↑", "↓"], label: "Navegar entre resultados" },
          { keys: ["Ctrl", "J/K"], label: "Navegar (vim-style)" },
          { keys: ["Home", "End"], label: "Primeiro / último resultado" },
          { keys: ["Ctrl", "1-9"], label: "Selecionar N-ésimo resultado" },
          { keys: [mod, "D"], label: "Fixar / desafixar item ativo" },
          { keys: ["Enter"], label: "Abrir resultado selecionado" },
          { keys: ["Esc"], label: "Fechar busca" },
        ],
      },
      {
        title: "Filtros do palette",
        items: [
          { keys: [">"], label: "Mostrar apenas ações" },
          { keys: ["#"], label: "Mostrar apenas navegação" },
          { keys: ["@"], label: "Mostrar apenas recentes" },
        ],
      },
    ],
    [mod]
  );

  const filteredGroups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            it.keys.join(" ").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          key="help-overlay"
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Fechar ajuda"
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          />

          <m.div
            role="dialog"
            aria-label="Atalhos de teclado"
            className={cn(
              "relative z-10 w-full max-w-[640px] overflow-hidden rounded-2xl border border-border/70",
              "bg-card text-foreground shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)]"
            )}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl border border-border/60 bg-muted/40 text-primary">
                  <Keyboard size={18} />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Atalhos de teclado</h2>
                  <p className="text-xs text-muted-foreground">
                    Acelere sua navegação no portal administrativo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                <Search size={14} className="text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar atalhos..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="Limpar"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {["Geral", "vim", "Alt", "busca", "palette"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuery(preset)}
                    className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              {filteredGroups.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum atalho corresponde a "{query}".
                </p>
              ) : (
                <div className="grid gap-5">
                  {filteredGroups.map((group) => (
                    <section key={group.title}>
                      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                        {group.title}
                      </h3>
                      <ul className="grid gap-1.5">
                        {group.items.map((item) => (
                          <li
                            key={item.label}
                            className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2.5 py-1.5 transition hover:border-border/60 hover:bg-muted/30"
                          >
                            <span className="text-sm text-foreground/90">{item.label}</span>
                            <div className="flex items-center gap-1">
                              {item.keys.map((key, idx) => (
                                <React.Fragment key={`${item.label}-${idx}`}>
                                  {idx > 0 ? (
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                      depois
                                    </span>
                                  ) : null}
                                  <kbd className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[11px] font-bold text-foreground">
                                    {key}
                                  </kbd>
                                </React.Fragment>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground">
              <span>
                Pressione{" "}
                <kbd className="inline-flex items-center rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px]">
                  ?
                </kbd>{" "}
                novamente para fechar
              </span>
              <span>Portal Admin · Atalhos</span>
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
