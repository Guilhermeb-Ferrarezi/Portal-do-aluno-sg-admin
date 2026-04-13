# Roadmap: Portal do Aluno

## v1.0 Gamificacao, Multi-Curso e Observabilidade

**Milestone Goal:** ampliar engajamento do portal com gamificacao e suporte a multiplos cursos, enquanto melhora a diagnostica operacional com logs mais informativos.

## Overview

Esta milestone evolui o portal interno de professores e administradores em cinco passos coerentes: primeiro aumenta a capacidade de diagnostico com observabilidade melhor, depois organiza a entrada multi-curso, expande a gestao de medalhas, introduz rankings com recortes temporais e fecha com a integracao de recompensas e validacao operacional dos fluxos principais.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Observabilidade Acionavel** - enriquecer logs e contexto operacional dos fluxos mais criticos.
- [ ] **Phase 2: Entrada Multi-Curso** - permitir selecao do contexto de curso ou atuacao logo na entrada.
- [ ] **Phase 3: Medalhas com Recompensa Ampliada** - ampliar a gestao de medalhas e atribuicoes com mais contexto.
- [ ] **Phase 4: Rankings por Nota** - entregar leaderboard com recortes de periodo para usuarios internos.
- [ ] **Phase 5: Recompensas de Ranking e Fechamento** - vincular recompensas aos rankings e endurecer a integracao final.

## Phase Details

### Phase 1: Observabilidade Acionavel
**Goal**: Enriquecer observabilidade de requests, auth e presence para diagnostico rapido dos fluxos internos mais sensiveis.
**Depends on**: Nothing (first phase)
**Requirements**: [OBSV-01, OBSV-02]
**Success Criteria** (what must be TRUE):
  1. Admin consegue identificar em logs qual rota critica falhou, com status, ator e contexto suficiente para acao.
  2. Eventos de auth e presence registram contexto util sem quebrar compatibilidade das rotas existentes.
  3. O sistema diferencia melhor sucesso, erro e falha operacional nos fluxos acompanhados.
**Plans**: TBD

Plans:
- [ ] 01-01: Mapear gaps de observabilidade nos fluxos criticos e definir campos de log reutilizaveis.
- [ ] 01-02: Implementar enriquecimento de logs no backend para requests, auth e presence.
- [ ] 01-03: Validar exposicao e consumo desses sinais nas telas administrativas existentes.

### Phase 2: Entrada Multi-Curso
**Goal**: Permitir que professores e admins com mais de um contexto interno escolham qual dashboard seguir ao entrar e manter esse contexto durante a sessao.
**Depends on**: Phase 1
**Requirements**: [MCUR-01, MCUR-02]
**Success Criteria** (what must be TRUE):
  1. Usuario com mais de um contexto interno recebe uma escolha clara de curso ou atuacao ao entrar.
  2. O contexto selecionado persiste durante a sessao e orienta o carregamento inicial do dashboard.
  3. Usuarios com apenas um contexto seguem entrando sem friccao adicional.
**Plans**: TBD

Plans:
- [ ] 02-01: Descobrir e modelar o contexto multi-curso reaproveitando dados e contratos ja existentes.
- [ ] 02-02: Implementar selecao de contexto no fluxo de entrada e persistencia na sessao.
- [ ] 02-03: Ajustar navegacao inicial e carregamento do dashboard conforme contexto escolhido.

### Phase 3: Medalhas com Recompensa Ampliada
**Goal**: Expandir a gestao de medalhas para suportar recompensa ampliada e atribuicoes com contexto administrativo claro.
**Depends on**: Phase 2
**Requirements**: [MEDA-01, MEDA-02]
**Success Criteria** (what must be TRUE):
  1. Admin consegue cadastrar ou editar medalhas com descricao de recompensa e criterio entendiveis.
  2. Atribuicoes exibem contexto suficiente para auditoria interna do motivo e da recompensa associada.
  3. O fluxo atual de medalhas continua funcional para quem ja usa o painel.
**Plans**: TBD

Plans:
- [ ] 03-01: Revisar contratos e UI atuais de medalhas para suportar recompensa ampliada sem quebrar o fluxo existente.
- [ ] 03-02: Implementar gestao de medalhas e atribuicoes com contexto administrativo adicional.
- [ ] 03-03: Validar consistencia de exibicao, filtros e estados do painel de medalhas.

### Phase 4: Rankings por Nota
**Goal**: Entregar rankings por nota com recortes de periodo adequados ao uso interno por professores e admins.
**Depends on**: Phase 3
**Requirements**: [RANK-01, RANK-02]
**Success Criteria** (what must be TRUE):
  1. Usuario interno consegue abrir um ranking por nota com ordenacao consistente.
  2. O ranking alterna entre recortes diario, semanal e geral com comportamento previsivel.
  3. A navegacao do ranking respeita o contexto de curso selecionado quando aplicavel.
**Plans**: TBD

Plans:
- [ ] 04-01: Definir fonte de dados e contrato do ranking por nota dentro das restricoes atuais do sistema.
- [ ] 04-02: Implementar endpoint e consumo frontend para ranking com recortes temporais.
- [ ] 04-03: Integrar ranking ao dashboard interno com estados de carregamento, vazio e erro.

### Phase 5: Recompensas de Ranking e Fechamento
**Goal**: Vincular recompensas aos rankings e fechar a milestone com integracao, smoke operacional e documentacao das rotas novas.
**Depends on**: Phase 4
**Requirements**: [RANK-03]
**Success Criteria** (what must be TRUE):
  1. Admin consegue associar recompensa ou destaque a posicoes e recortes relevantes do ranking.
  2. Fluxos de ranking, medalhas, entrada multi-curso e observabilidade funcionam de forma integrada.
  3. Rotas novas ficam documentadas no swagger e o smoke operacional da milestone passa.
**Plans**: TBD

Plans:
- [ ] 05-01: Implementar associacao de recompensa ou destaque aos rankings.
- [ ] 05-02: Fechar integracao entre ranking, medalhas e contexto de curso.
- [ ] 05-03: Atualizar documentacao e executar verificacoes finais da milestone.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Observabilidade Acionavel | 0/3 | Not started | - |
| 2. Entrada Multi-Curso | 0/3 | Not started | - |
| 3. Medalhas com Recompensa Ampliada | 0/3 | Not started | - |
| 4. Rankings por Nota | 0/3 | Not started | - |
| 5. Recompensas de Ranking e Fechamento | 0/3 | Not started | - |
