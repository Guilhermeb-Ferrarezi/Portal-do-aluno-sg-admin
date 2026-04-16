# Dashboard Flat Refactor Plan
Status: [ ] pending

## Context
The `Dashboard.tsx` component uses a heavy card visual language (rounded-2xl, shadows, hero banner, conic-gradient ring). Goal: refactor to a flat, data-dense style inspired by AbacatePay — thin borders, data-first rows, whitespace as divider, no decorative surfaces.

Only `Dashboard.tsx` changes. `DashboardLayout.tsx`, `card.tsx`, and all other files are untouched.

---

## Import Changes

Remove from Dashboard.tsx:
```tsx
// Remove:
Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle  // from @/components/ui/card
Separator                                                               // from @/components/ui/separator
ShieldCheck                                                             // from lucide-react (hero only)
```

---

## Component Changes

### Delete: `RingProgress` (lines 52–71)
Conic-gradient circle removed entirely. Replace with inline `{progressoOverall}%` text.

### Delete: `surfaceClass` + `SurfaceCard` (lines 79–89)
```tsx
// BEFORE
const surfaceClass = "overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow)]";
function SurfaceCard({ className, ...props }) {
  return <Card className={cn(surfaceClass, className)} {...props} />;
}

// AFTER — replace with plain grouping div
function FlatSection({ className, children, ...props }) {
  return <div className={cn("flex flex-col", className)} {...props}>{children}</div>;
}
```

### Replace: `MetricCard` → `MetricCell`
```tsx
// BEFORE: SurfaceCard > CardHeader (3xl value) > CardContent (MetricRows + Separator)
// AFTER:
const statCellClass = "flex flex-col gap-1 rounded-md border border-border/60 bg-card px-4 py-3";

function MetricCell({ kicker, value, subtext, delay }) {
  return (
    <m.div className={statCellClass} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.18 }}>
      <span className={eyebrowClass}>{kicker}</span>
      <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</span>
      {subtext ? <span className="text-xs text-muted-foreground">{subtext}</span> : null}
    </m.div>
  );
}
// The "rows" array collapses to a single subtext string e.g. "12 publicados · 3 programados"
```

### Replace: `LoadingMetricCard` → `LoadingMetricCell`
Smaller skeletons matching `statCellClass`: `h-2.5 w-20`, `h-7 w-14`, `h-2 w-28`. Corner: `rounded` not `rounded-full`.

### Update: `MetricRows` — remove `<Separator>`
```tsx
// BEFORE: each row + <Separator className="bg-border/60" />
// AFTER: border-b on each row div
<div className="flex items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground border-b border-border/40 last:border-0">
```

### Delete: Hero banner (lines 370–407)
Remove entire `isManagementView` hero block. The three badge values (totalAlunos, exerciciosAtivos, taxaAgendamento) surface as `subtext` on the relevant `MetricCell` instead.

### Update: Loading state (lines 319–338)
Remove hero skeleton (banner gone). Render only `LoadingMetricCell` grid.

### Update: Error state (lines 341–364)
```tsx
// BEFORE: SurfaceCard > CardHeader + CardContent
// AFTER:
<div className="flex flex-col gap-3 max-w-2xl">
  <h2 className="text-xl font-bold tracking-tight text-foreground">Falha ao carregar dashboard</h2>
  <p className="text-sm text-muted-foreground">{erro}</p>
  <Button variant="outline" className="w-fit rounded-md px-4" onClick={() => window.location.reload()}>
    <RefreshCcw data-icon="inline-start" /> Tentar novamente
  </Button>
</div>
```

### Update: Exercise list (lines 491–557)
```tsx
// BEFORE: SurfaceCard > CardHeader + rounded-[1.25rem] border bg-muted/20 buttons
// AFTER:
<div>
  <div className="mb-3">
    <h2 className="text-sm font-semibold text-foreground">Exercicios recentes</h2>
    <p className="text-xs text-muted-foreground">Ultimas publicacoes e prazos relevantes.</p>
  </div>
  <div className="flex flex-col divide-y divide-border/40">
    {exerciciosRecentes.map((ex) => (
      <button key={ex.id}
        className="flex items-center gap-3 py-3 px-1 -mx-1 rounded-sm text-left hover:bg-muted/30 transition"
        onClick={() => navigate(`/dashboard/exercicios/${ex.id}`)} type="button">
        <span className={cn("size-1.5 shrink-0 rounded-full", ...)} />
        <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-foreground">{ex.titulo}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{dateString}</span>
        </div>
        {isProgrammed ? <Badge variant="outline" className="h-5 rounded px-1.5 text-[0.6rem]">Agendado</Badge> : null}
      </button>
    ))}
  </div>
</div>
// Empty state: plain <div className="py-8 text-center text-sm text-muted-foreground"> (no dashed box)
```

### Update: Progress panel (lines 559–583)
```tsx
// BEFORE: SurfaceCard > CardHeader (RingProgress + %) + CardContent (MetricRows)
// AFTER:
<div className="flex flex-col gap-0">
  <div className="mb-3">
    <p className={eyebrowClass}>{isManagementView ? "Saude operacional" : "Progresso"}</p>
    <div className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
      {progressoOverall}<span className="text-base font-semibold text-muted-foreground">%</span>
    </div>
  </div>
  <MetricRows rows={[{ label: progressoLabelA, value: progressoValueA }, { label: progressoLabelB, value: progressoValueB }]} />
</div>
```

### Update: Quick actions (lines 587–645)
```tsx
// BEFORE: SurfaceCard > CardHeader + grid with h-14 rounded-2xl size="lg" buttons
// AFTER:
<div>
  <h2 className="mb-1 text-sm font-semibold text-foreground">Acoes rapidas</h2>
  <p className="mb-4 text-xs text-muted-foreground">Atalhos diretos para as areas operacionais mais usadas.</p>
  <div className="flex flex-wrap gap-2">
    <Button variant="default" className="justify-start rounded-md" onClick={...}>
      <PenLine data-icon="inline-start" /> Exercicios
    </Button>
    {/* ... other buttons with same pattern */}
  </div>
</div>
// size="lg" and h-14 removed; rounded-2xl → rounded-md
```

### Update: Framer Motion
All `initial={false}` → `initial={{ opacity: 0 }}`. Duration `0.3` → `0.18` throughout.

---

## Section Layout After Refactor

```
DashboardLayout
└── FadeInUp
    └── flex flex-col gap-8
        ├── KPI grid  (grid gap-3 md:grid-cols-2 xl:grid-cols-4)
        │   └── MetricCell × 4 (admin) / × 3 (student)
        │
        ├── Two-column  (lg:grid-cols-[1.65fr_0.95fr])
        │   ├── Exercicios recentes  (section header + divide-y rows)
        │   └── Progresso / Saude   (eyebrow + big % + MetricRows)
        │
        └── Acoes rapidas  (section header + flex-wrap gap-2 buttons)
```

---

## Verification

1. `cd Portal-do-aluno/web && bun run lint` — must pass with no new errors
2. `bun run build` — must complete cleanly
3. Visual smoke test — open `/dashboard` as admin, professor, and aluno and confirm:
   - No rounded-2xl card boxes visible (sections flat, separated by whitespace)
   - KPI numbers in thin-border stat cells (`rounded-md border border-border/60`)
   - Exercise list shows flat `divide-y` rows (no card around each row)
   - Progress shows `XX%` text with MetricRows below (no ring circle)
   - Quick action buttons use `rounded-md` (visually flatter)
   - Hero banner is gone
