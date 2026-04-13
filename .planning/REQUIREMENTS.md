# Requirements: Portal do Aluno

**Defined:** 2026-04-13
**Core Value:** O portal precisa funcionar como a superficie principal e confiavel de acompanhamento academico e operacional para quem usa o sistema todos os dias.

## v1 Requirements

### Medalhas

- [ ] **MEDA-01**: Admin pode cadastrar e editar medalhas com descricao clara de recompensa e criterio de atribuicao.
- [ ] **MEDA-02**: Admin pode visualizar atribuicoes de medalhas com contexto suficiente para entender quem recebeu, por que recebeu e qual recompensa foi vinculada.

### Rankings

- [ ] **RANK-01**: Usuario interno pode visualizar ranking por nota com ordenacao consistente entre participantes elegiveis.
- [ ] **RANK-02**: Usuario interno pode alternar o ranking entre recortes de periodo como diario, semanal e geral.
- [ ] **RANK-03**: Admin pode vincular recompensas ou destaques aos recortes e posicoes relevantes do ranking.

### Multi-Curso

- [ ] **MCUR-01**: Professor ou admin com mais de um curso ou contexto interno pode escolher qual dashboard deseja seguir ao entrar.
- [ ] **MCUR-02**: O contexto de curso selecionado persiste durante a sessao e orienta navegacao e carregamento inicial do dashboard.

### Observabilidade

- [ ] **OBSV-01**: Admin pode consultar logs mais informativos para requests criticos com rota, ator, resultado e contexto operacional.
- [ ] **OBSV-02**: Eventos de auth, presence e falhas relevantes registram contexto suficiente para diagnostico sem depender de reproducao cega.

## v2 Requirements

### Gamificacao

- **GAMI-01**: O sistema concede medalhas e recompensas automaticamente com regras programaveis.
- **GAMI-02**: Rankings disparam campanhas ou notificacoes internas automatizadas.

### Multi-Curso

- **MCUR-03**: Usuario interno pode comparar indicadores entre cursos em uma visao consolidada.

### Observabilidade

- **OBSV-03**: O painel de observabilidade oferece metricas agregadas e alertas operacionais em tempo real.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Portal para alunos | O usuario confirmou que este projeto e apenas para professores e admins |
| Alteracoes de schema sem aprovacao | O repositorio exige validacao explicita antes de mudar banco |
| Redesign completo da interface | A milestone foca em capacidade, navegacao e diagnostico |
| Automacoes externas de recompensa | A milestone atual cobre gestao e exibicao, nao integracoes externas |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OBSV-01 | Phase 1 | Pending |
| OBSV-02 | Phase 1 | Pending |
| MCUR-01 | Phase 2 | Pending |
| MCUR-02 | Phase 2 | Pending |
| MEDA-01 | Phase 3 | Pending |
| MEDA-02 | Phase 3 | Pending |
| RANK-01 | Phase 4 | Pending |
| RANK-02 | Phase 4 | Pending |
| RANK-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after initial milestone definition*
