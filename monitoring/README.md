# Observabilidade

Esta pasta versiona a primeira fase da observabilidade operacional do `portal-do-aluno`.

## Componentes

- `Prometheus`: raspa as métricas HTTP expostas pelo `api` em `/api/metrics`
- `Loki`: armazena logs técnicos estruturados
- `Grafana Alloy`: coleta os logs JSON do container `api` via Docker e envia para o Loki

## Easypanel / LGTM existente

Se voce ja tem um stack LGTM rodando no Easypanel, este e o caminho recomendado.

### Prometheus

Adicione o job de scrape de [prometheus.portal-do-aluno.yml](/home/guilherme/Desktop/Santos%20techg/portal-do-aluno/monitoring/easypanel/prometheus.portal-do-aluno.yml) ao Prometheus existente. O alvo esperado e:

- `api:3000/api/metrics`

### Alloy

Adicione o bloco de [alloy.portal-do-aluno.alloy](/home/guilherme/Desktop/Santos%20techg/portal-do-aluno/monitoring/easypanel/alloy.portal-do-aluno.alloy) ao Alloy existente. Ele coleta os logs JSON do container `api` e envia para `http://loki:3100/loki/api/v1/push`.

Se no seu Easypanel o Loki nao estiver acessivel em `http://loki:3100`, troque a URL do bloco `loki.write "portal_do_aluno"` para o host interno correto do seu stack.

### Testes

Depois de aplicar isso no Easypanel:

1. Prometheus: rode a query `up{job="portal-do-aluno-api"}`
2. Loki: rode a query `{service="portal-do-aluno-api"}`
3. Gere trafego no `api` e confirme os campos `request_id`, `route`, `status_code` e `duration_ms`

## Stack local opcional

Se quiser rodar observabilidade local fora do Easypanel, os servicos `loki`, `prometheus` e `alloy` continuam no compose, mas agora ficam atras do profile `local-observability`.

1. Suba a stack com `docker compose --profile local-observability up -d --build`.
2. A API passará a expor:
   - `GET /health`
   - `GET /api/health`
   - `GET /metrics`
   - `GET /api/metrics`
3. No Grafana, crie datasources para:
   - Se o Grafana estiver na mesma rede Docker: `http://prometheus:9090` e `http://loki:3100`
   - Se o Grafana estiver fora do compose: use o host publicado, por exemplo `http://SEU_HOST:9090` e `http://SEU_HOST:3100`

## Métricas principais

- `portal_do_aluno_api_http_requests_total`
- `portal_do_aluno_api_http_request_errors_total`
- `portal_do_aluno_api_http_request_duration_ms`

## Campos principais de log

- `request_id`
- `method`
- `route`
- `status_code`
- `duration_ms`
- `user_id`
- `role`
- `ip`
- `user_agent`
- `error_type`
