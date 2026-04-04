import { cn } from "@/lib/utils";

export const pageContainerClass = "flex flex-col gap-5";

export const panelClass =
  "rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.12)] sm:p-6";

export const subtlePanelClass = "rounded-[24px] border border-border/70 bg-muted/20 p-4";

export const sectionTitleClass = "text-2xl font-black tracking-[-0.03em] text-foreground sm:text-[1.9rem]";

export const helperTextClass = "text-xs leading-5 text-muted-foreground";

export const fieldGroupClass = "flex flex-col gap-2";

export const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

export const fieldInputClass =
  "h-11 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/30";

export const fieldTextareaClass = cn(fieldInputClass, "h-auto min-h-28 py-3 leading-6");

export const fieldSelectClass = cn(fieldInputClass, "appearance-none pr-10");

export const warningControlClass = "border-amber-300/80 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10";

export const warningTextClass = "text-xs font-medium text-amber-700 dark:text-amber-300";

export const rowClass = "grid gap-4 xl:grid-cols-3";

export const compactRowClass = "grid gap-4 md:grid-cols-2";

export const radioRowClass = "mt-2 flex flex-wrap gap-3";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldWarnWrapClass = (warning = false) =>
  cn(
    "rounded-[24px] transition",
    warning && "rounded-[24px] border border-amber-300/80 bg-amber-50/60 p-2 dark:border-amber-500/30 dark:bg-amber-500/10"
  );

export const toggleGroupClass = (warning = false) =>
  cn(
    "grid gap-2 rounded-[24px] border border-border/70 bg-muted/25 p-3",
    warning && "border-amber-300/80 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
  );

export const toggleOptionClass = (active: boolean) =>
  cn(
    "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition",
    active
      ? "border-primary/45 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.12)]"
      : "border-border/70 bg-background/75 text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground"
  );

export const toggleDotClass = (active: boolean) =>
  cn(
    "inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition",
    active
      ? "border-primary/60 bg-primary/10 shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.12)]"
      : "border-border/70 bg-background/80"
  );

export const toggleDotInnerClass = (active: boolean) =>
  cn("size-2 rounded-full transition", active ? "bg-primary" : "bg-transparent");

export const courseSelectedClass = (hasSelection: boolean) =>
  cn(
    "grid gap-1 rounded-2xl border px-4 py-3",
    hasSelection
      ? "border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10"
      : "border-border/70 bg-muted/35"
  );

export const statusToggleClass = (active: boolean) =>
  cn(
    "flex h-full cursor-pointer items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition",
    active
      ? "border-primary/45 bg-primary/10"
      : "border-border/70 bg-background/80 hover:border-primary/30 hover:bg-accent/60"
  );

export const responseCardClass =
  "rounded-[24px] border border-sky-500/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(15,23,42,0.52))] transition hover:border-sky-400/35 hover:shadow-[0_14px_34px_rgba(2,6,23,0.22)]";

export const responseBadgeClass =
  "inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground";

export const loadingStateClass =
  "flex min-h-36 flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-sm text-muted-foreground";

export const spinnerClass =
  "size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary";

export const emptyStateClass =
  "flex min-h-40 flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center";

export const emptyIconClass =
  "inline-flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground";

export const emptyTitleClass = "text-lg font-semibold text-foreground";

export const exerciseCardClass = (canEditCard: boolean) =>
  cn(
    "grid gap-5 rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.12)] transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:p-6",
    canEditCard && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_20px_40px_rgba(0,0,0,0.16)]"
  );

export const exercisePillClass = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";

export const exerciseTypePillClass = (kind: string) =>
  cn(
    exercisePillClass,
    kind === "isCodigo" && "border-violet-500/30 bg-violet-500/10 text-violet-200",
    kind === "isEscrita" && "border-rose-500/30 bg-rose-500/10 text-rose-200",
    kind === "isMouse" && "border-sky-500/30 bg-sky-500/10 text-sky-200",
    kind === "isMultipla" && "border-amber-500/30 bg-amber-500/10 text-amber-200",
    kind === "isAtalho" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    kind === "isDefault" && "border-border/70 bg-background/75 text-muted-foreground"
  );

export const accessBadgeClass = (tone: "aluno" | "turmas" | "all") =>
  cn(
    exercisePillClass,
    tone === "aluno" && "border-primary/30 bg-primary/10 text-primary",
    tone === "turmas" && "border-sky-500/30 bg-sky-500/10 text-sky-200",
    tone === "all" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
  );

export const turmaBadgeClass = (tipo: string) =>
  cn(
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
    tipo === "turma"
      ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200"
      : "border-orange-500/30 bg-orange-500/10 text-orange-200"
  );

export const modalBodyClass = "flex flex-col gap-4";

export const modalFooterButtonClass =
  "inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const modalFooterGhostButtonClass = cn(
  modalFooterButtonClass,
  "border border-border/70 bg-background/80 text-foreground hover:bg-muted"
);

export const modalFooterPrimaryButtonClass = cn(
  modalFooterButtonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90"
);
