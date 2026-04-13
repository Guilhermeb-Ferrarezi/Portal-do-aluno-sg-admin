# Portal do Aluno

## What This Is

Portal web para alunos, professores e administradores acompanharem turmas, exercicios, estrutura de curso, medalhas e operacao do sistema em um unico dashboard. O produto ja possui autenticacao, rotas protegidas por perfil, presenca em tempo real e paines administrativos, e agora entra em uma milestone focada em gamificacao, suporte a multi-curso e melhor observabilidade.

## Core Value

O portal precisa funcionar como a superficie principal e confiavel de acompanhamento academico e operacional para quem usa o sistema todos os dias.

## Current Milestone: v1.0 Gamificacao, Multi-Curso e Observabilidade

**Goal:** ampliar engajamento do portal com gamificacao e suporte a multiplos cursos, enquanto melhora a diagnostica operacional com logs mais informativos.

**Target features:**
- Sistema de medalhas com recompensas ampliadas.
- Sistema de rankings por nota, incluindo recortes diarios e semanais com recompensas.
- Divisao de cursos para alunos com mais de um curso, com escolha de qual dashboard seguir ao entrar.
- Logs de observabilidade mais informativos para backend e fluxos criticos.
- Melhorias complementares vindas dos outros steps apenas se couberem sem expandir demais o escopo.

## Requirements

### Validated

- [x] Usuarios autenticam com login, refresh e logout, incluindo SSO e rotas protegidas por papel.
- [x] O dashboard principal ja atende alunos, professores e administradores com navegacao protegida.
- [x] O portal ja opera turmas, exercicios, estrutura de curso, videoaulas e medalhas.
- [x] O backend ja expone observabilidade basica, logs de atividade e presenca em tempo real.

### Active

- [ ] Expandir o sistema de medalhas com recompensas ampliadas.
- [ ] Criar rankings por nota com recortes temporais e recompensas.
- [ ] Permitir escolha de curso/dashboard para alunos com mais de um curso.
- [ ] Tornar logs e sinais de observabilidade mais informativos para diagnostico.

### Out of Scope

- Alteracoes de schema sem aprovacao explicita do usuario - o repositorio exige validar primeiro se campos existentes ja atendem.
- Quebra de compatibilidade das rotas atuais de auth, presence e proxy - esses fluxos sao criticos e precisam permanecer estaveis.
- Redesign completo da UI - a milestone foca em capacidade e clareza operacional, preservando a linguagem visual existente.

## Context

- Stack principal: `web` com React 19, Vite 7, TypeScript, Tailwind 4, shadcn/ui e Radix UI; `api` com Express 5, TypeScript, PostgreSQL, JWT e WebSocket.
- O projeto ja possui pages e rotas para `Dashboard`, `Exercises`, `EstruturaCurso`, `Turmas`, `Medalhas`, `ActivityLogs` e `AdminObservability`.
- O backend ja documenta auth e presence no OpenAPI e mantem compatibilidade com e sem prefixo `/api` em rotas que seguem esse padrao.
- Presenca em tempo real e heartbeat HTTP sao fluxos sensiveis e nao podem ser quebrados durante evolucao da milestone.
- O projeto ja recebeu reforco recente em lint, build e smoke E2E com Playwright, entao a milestone pode aproveitar uma base melhor de verificacao.

## Constraints

- **Schema**: Nao criar nem alterar tabelas ou colunas sem aprovacao explicita - evita deriva no banco e quebra em ambiente existente.
- **Compatibilidade**: Preservar auth, presence, proxy e contratos atuais - sao fluxos centrais do produto.
- **Frontend**: Reutilizar componentes de `web/src/components/ui` e padroes visuais existentes - reduz regressao visual e manutencao.
- **Observabilidade**: Melhorias devem aumentar contexto util, nao apenas volume de log - o foco e diagnostico acionavel.
- **Documentacao**: Toda rota nova precisa entrar no swagger - regra explicita do repositorio.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Priorizar gamificacao, multi-curso e observabilidade na primeira milestone formal | Sao os proximos blocos pedidos pelo usuario e se conectam com o que ja existe no portal | - Pending |
| Tratar observabilidade como capacidade funcional desta milestone, e nao como tarefa secundaria | Logs mais informativos reduzem tempo de diagnostico nas areas criticas do produto | - Pending |
| Preservar banco e contratos existentes como restricao de planejamento | O projeto tem dependencias reais em auth, presence, proxy e integracao com schema atual | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after milestone v1.0 initialization*
