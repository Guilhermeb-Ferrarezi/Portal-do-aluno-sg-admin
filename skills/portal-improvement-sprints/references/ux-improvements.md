# Melhorias UI/UX — Checklists por Sprint

> Arquivo complementar ao `sprint-board.md`. Aqui ficam os itens detalhados de UI/UX com contexto de implementacao e arquivos-chave.

---

## Sprint 2 — Melhorias de UX (Alto impacto)

- [ ] **Empty states padronizados**
  - Criar componente `EmptyState` reutilizavel com icone + texto + botao de CTA opcional
  - Aplicar em: `Exercises.tsx`, `Turmas.tsx`, `Materiais.tsx`, `Medalhas.tsx`, `AdminUsers.tsx`
  - Base: `web/src/components/ui/` (criar `empty-state.tsx`)

- [ ] **Quick action bar por papel**
  - Admin: criar usuario, criar turma, criar exercicio em um clique
  - Professor: duplicar exercicio, adicionar aluno em lote
  - Aluno: atalho para ultimo exercicio, ver pendentes
  - Arquivo: `web/src/components/Dashboard/DashboardLayout.tsx`

- [ ] **Context menus nas listagens**
  - Padrao ja existe em `AdminUsers.tsx` (right-click + dropdown)
  - Estender para: `Exercises.tsx`, `Turmas.tsx`, `Materiais.tsx`
  - Componente base: `web/src/components/ui/context-menu.tsx` (ja existe)

- [ ] **Duplicar rascunho / sugestoes contextuais**
  - Botao "Duplicar de existente" nos formularios de criacao de exercicio e material
  - Agil para professores que criam conteudo similar com frequencia
  - Arquivos: `web/src/components/Exercise/CriarExercicioForm.tsx`

- [ ] **Feedback de upload e operacoes longas**
  - Barra de progresso para uploads no R2 (hoje sem feedback visual)
  - Spinner inline para operacoes pesadas de admin
  - Arquivo de upload: `api/src/utils/uploadR2.ts` + componentes frontend de upload

- [ ] **Tabelas responsivas no mobile**
  - Ocultar colunas de menor prioridade com `hidden sm:table-cell` ou similar
  - Afeta: listagem de usuarios, exercicios, turmas
  - Breakpoints: `sm` (640px), `md` (768px)

---

## Sprint 3 — Produtividade Admin (Medio impacto)

- [ ] **Acoes em lote**
  - Checkbox de multi-selecao nas listagens de usuarios e exercicios
  - Acoes coletivas: remover, exportar, atribuir turma
  - Arquivo: `web/src/pages/AdminUsers.tsx`, `Exercises.tsx`

- [ ] **Filtros com persistencia**
  - Salvar filtros ativos na URL via `searchParams` (React Router)
  - Hoje os filtros resetam ao navegar para outra pagina e voltar
  - Afeta: todos os filtros de listagem

- [ ] **Indicadores de presenca nas listas**
  - WebSocket de presenca ja funciona (`web/src/services/presenceSocket.ts`)
  - Adicionar badge "online" em cards e linhas de usuario/turma
  - Padrao de referencia ja existe em `AdminUsers.tsx`

- [ ] **Breadcrumb real no DashboardLayout**
  - Trilha de navegacao para rotas aninhadas como `/turmas/:id/exercicios`
  - Arquivo: `web/src/components/Dashboard/DashboardLayout.tsx`
  - Componente Radix `Breadcrumb` disponivel em `web/src/components/ui/`

- [ ] **Export de dados**
  - Botao exportar CSV em listagens de alunos e relatorios de turma
  - Pode ser client-side (stringify) ou endpoint no backend

---

## Sprint 5 — Acessibilidade e Polish (Alta visibilidade)

- [ ] **Tooltips em botoes de icone**
  - Todo botao com apenas icone (lixeira, lapis, olho, etc.) precisa de tooltip
  - Componente: `web/src/components/ui/tooltip.tsx` (ja existe no Radix)
  - Afeta: todas as paginas com acoes em linha

- [ ] **Skeleton loaders consistentes**
  - Substituir spinners avulsos pelo `Skeleton` ja existente
  - Arquivo base: `web/src/components/ui/skeleton.tsx`
  - Paginas que ainda usam spinner simples: verificar `Materiais.tsx`, `Medalhas.tsx`

- [ ] **`aria-label` em acoes interativas**
  - Adicionar `aria-label` em botoes de icone, menus e campos sem label visivel
  - Afeta principalmente: tabelas de admin e formularios de criacao

- [ ] **`prefers-reduced-motion`**
  - Usar `useReducedMotion()` do Framer Motion para desabilitar animacoes quando usuario preferir
  - Afeta: `web/src/components/animate-ui/` e animacoes em paginas

- [ ] **Transicoes de rota**
  - `AnimatePresence` nas rotas do `web/src/App.tsx`
  - Fade ou slide suave ao trocar de pagina
  - Respeitar `prefers-reduced-motion` (ver item acima)

---

## Backlog / Ideas

- [ ] Tema claro/escuro alternavel (Tailwind + CSS vars ja suportam)
- [ ] Command palette global (Ctrl+K) para navegacao rapida — alta complexidade
- [ ] Notificacoes push / Service Worker para alertas fora do portal
- [ ] Tour guiado para novos usuarios (onboarding)

---

## Arquivos-chave de referencia

| Area | Arquivo |
|------|---------|
| Layout e sidebar | `web/src/components/Dashboard/DashboardLayout.tsx` |
| Componentes UI base | `web/src/components/ui/` |
| Animacoes | `web/src/components/animate-ui/` e `web/src/components/ui` |
| Padrao de context menu | `web/src/pages/AdminUsers.tsx` |
| Presenca WebSocket | `web/src/services/presenceSocket.ts` |
| Roteamento | `web/src/App.tsx` |
| Upload R2 | `api/src/utils/uploadR2.ts` |
