# Sprint Board

Legenda:
- `[x]` concluido e validado
- `[ ]` pendente

Atualize a linha `Progresso:` manualmente sempre que um item mudar.

## Sprint 0 - Base forte ja existente

Objetivo: registrar o que ja esta bem resolvido e serve de base para as proximas melhorias.

Progresso: `4/4`

- [x] Base visual do painel consolidada com Tailwind, shadcn/ui e Radix
- [x] Sessao com access token, refresh token e protecao de rotas
- [x] Presenca em tempo real com ticket HTTP e WebSocket
- [x] Infra local com Vite, Docker Compose e proxy Nginx

## Sprint 1 - Modularizacao do nucleo

Objetivo: reduzir hotspots grandes e acelerar manutencao sem mudar o produto visivel.

Progresso: `6/6`

- [x] Quebrar `web/src/services/api.ts` em modulos por dominio, preservando compatibilidade da API publica
- [x] Extrair `useAuthSession` da logica de sessao hoje espalhada em `web/src/App.tsx` e `web/src/auth/auth.ts`
- [x] Extrair `usePresenceSocket` para encapsular conexao, heartbeat, reconexao e limpeza
- [x] Separar helpers puros de filtros, normalizacao e formatacao hoje embutidos em paginas grandes
- [x] Fatiar `web/src/pages/Exercises.tsx` em subcomponentes e hooks menores
- [x] Fatiar `api/src/routes/exercicios.route.ts` e `api/src/routes/turmas.route.ts` por capacidade ou feature

## Sprint 2 - UX de alto valor

Objetivo: melhorar o que ja esta bom sem reinventar a base visual do painel.

Progresso: `0/6`

- [ ] Adicionar uma barra de acoes rapidas no dashboard para admin, professor e aluno
- [ ] Padronizar estados vazios com CTA util e mensagem contextual
- [ ] Padronizar estados de loading, erro e retry com componentes reutilizaveis
- [ ] Revisar responsividade dos paineis mais densos em mobile e telas intermediarias
- [ ] Expandir context menus uteis para listas-chave alem de `AdminUsers`
- [ ] Adicionar sugestoes contextuais como `duplicar rascunho`, `criar primeira turma` e `revisar pendencias`

## Sprint 3 - Produtividade administrativa e tempo real

Objetivo: transformar operacoes comuns em fluxos mais rapidos e mais claros.

Progresso: `0/5`

- [ ] Implementar acoes em lote em usuarios, turmas e exercicios
- [ ] Exibir ultima atividade e status de presenca com filtros para administracao
- [ ] Criar indicadores de pendencia de revisao no dashboard e nas listas principais
- [ ] Adicionar endpoints ou resumos de presenca se o frontend precisar de consultas mais leves
- [ ] Revisar feedback visual para conflitos, retry e operacoes demoradas

## Sprint 4 - Robustez e observabilidade

Objetivo: aumentar confianca para evoluir o produto sem regressao escondida.

Progresso: `0/6`

- [ ] Criar testes de API para login, refresh token e logout
- [ ] Criar testes para ticket de presenca, heartbeat e permissao de WebSocket
- [ ] Introduzir smoke tests do fluxo critico `login -> dashboard -> logout`
- [ ] Centralizar o mapeamento de erros do frontend em uma camada reutilizavel
- [ ] Estruturar logs de auth, upload e realtime no backend
- [ ] Revisar rate limits, health checks e mensagens de falha

## Sprint 5 - Acessibilidade e polimento final

Objetivo: elevar a qualidade percebida e a inclusao sem descaracterizar o design atual.

Progresso: `0/5`

- [ ] Auditar foco, tab order e navegacao por teclado nas telas principais
- [ ] Revisar contraste e legibilidade em cards, dialogs e menus
- [ ] Revisar labels, aria e feedback de validacao em formularios
- [ ] Adicionar suporte a `prefers-reduced-motion` onde houver animacao importante
- [ ] Fazer uma passada final de consistencia visual entre paginas

## Backlog

Objetivo: capturar ideias validas que nao precisam entrar nas sprints ativas agora.

Progresso: `0/4`

- [ ] Considerar um comando rapido global para navegacao e acoes frequentes
- [ ] Considerar uma camada central de cache e invalidacao de dados no frontend
- [ ] Considerar uma auditoria de performance para Monaco e bundles grandes
- [ ] Considerar um manual interno de componentes e padroes visuais do painel
