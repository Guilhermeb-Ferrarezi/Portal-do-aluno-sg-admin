# Phase 1: Observabilidade Acionavel - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase melhora a capacidade de diagnostico operacional do portal interno sem alterar o contrato central de auth, presence, proxy e banco. O foco e enriquecer logs e sinais de observabilidade nos fluxos mais criticos para que admins consigam entender rapidamente falhas, impacto e contexto.

</domain>

<decisions>
## Implementation Decisions

### Fonte de Verdade dos Logs
- Priorizar log estruturado no backend como trilha principal de observabilidade tecnica.
- Manter `activity logs` como trilha funcional de auditoria, sem tentar transformalos na unica fonte de diagnostico tecnico.
- Reaproveitar `requestObservability`, `logRequestError` e `logActivity` antes de criar novas camadas.

### Escopo Inicial
- Cobrir primeiro `auth`, `presence`, `/activity-logs`, `/metrics` e erros 4xx/5xx de rotas criticas.
- Preservar compatibilidade com rotas atuais com e sem prefixo `/api`.
- Nao quebrar o fluxo de presenca em tempo real nem o heartbeat HTTP.

### Exibicao no Frontend
- Reaproveitar `AdminObservability` e `ActivityLogs` nesta fase.
- Nao criar tela nova na Fase 1.
- Melhorias de UI devem surgir como extensoes coerentes das telas administrativas ja existentes.

### Nivel de Detalhe
- Incluir `request_id`, rota normalizada, actor, role, status, tipo de erro e contexto operacional util.
- Evitar payloads sensiveis, segredos, dumps grandes de body e ruido excessivo.
- Privilegiar campos acionaveis para diagnostico sobre volume bruto de log.

### the agent's Discretion
- O agente pode decidir a melhor distribuicao entre middleware de request, handlers de erro e enriquecimento dos activity logs, desde que preserve os contratos existentes e a clareza operacional.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/src/observability/requestObservability.ts` ja gera `http_request_completed` e `http_request_failed` com `request_id`, metodo, rota, status e erro serializado.
- `api/src/utils/activityLog.ts` ja registra trilha funcional em `logs`.
- `api/src/routes/activityLogs.ts` ja normaliza e expoe metadados de auditoria para admins.
- `web/src/pages/AdminObservability.tsx` ja consome `/metrics` e apresenta leitura visual das metricas da API.
- `web/src/pages/ActivityLogs.tsx` ja consome `listarActivityLogs` com filtros e detalhes expandidos.

### Established Patterns
- Backend centraliza cross-cutting concerns em middleware e helpers utilitarios.
- Frontend administrativo reaproveita `DashboardLayout`, `services/api` e cards densos ja alinhados com a linguagem visual do portal.
- OpenAPI e compatibilidade `/api` sao mantidos no backend sempre que a rota segue esse padrao.

### Integration Points
- `api/src/server.ts` e o ponto principal para observabilidade HTTP, metricas e error handler global.
- `api/src/routes/auth.ts` e `api/src/routes/presence.ts` sao pontos criticos para enriquecer contexto de auth/presence.
- `api/src/routes/activityLogs.ts` e a ponte para expor contexto adicional no painel administrativo.
- `web/src/pages/AdminObservability.tsx` e `web/src/pages/ActivityLogs.tsx` sao os pontos naturais para consumo das melhorias sem criar nova tela.

</code_context>

<specifics>
## Specific Ideas

- Tornar os logs de observabilidade mais informativos para o time interno foi pedido explicitamente pelo usuario.
- O portal e apenas para professores e admins; qualquer leitura de observabilidade deve refletir esse uso interno.
- A fase deve deixar o sistema mais diagnosticavel sem abrir escopo de redesign ou mudanca de schema.

</specifics>

<deferred>
## Deferred Ideas

- Dashboard agregado de alertas em tempo real ficou para `OBSV-03` em v2.
- Qualquer automacao externa de alerta, recompensa ou campanha fica fora desta fase.

</deferred>
