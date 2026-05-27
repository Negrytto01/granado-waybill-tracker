
## Objetivo

Transformar o app em uma plataforma integrável: expor endpoints REST autenticados por API Key para que outros sistemas (ERP, sites, scripts) leiam e escrevam dados, e deixar a base pronta para consumir APIs externas no futuro.

## 1. Banco de dados (migration)

Tabela `api_keys`:
- `nome` (identifica a integração, ex.: "ERP TOTVS")
- `key_hash` (hash SHA-256 da chave — chave em texto puro nunca é armazenada)
- `key_prefix` (8 primeiros caracteres visíveis para identificação, ex.: `gnd_live_a3f2...`)
- `permissoes` (jsonb com `{ read: ["recebimentos", ...], write: [...] }`)
- `ativo` (boolean)
- `ultimo_uso`, `total_chamadas`
- `criado_por`, `data_expiracao` (opcional)

Tabela `api_logs` (auditoria das chamadas externas):
- `api_key_id`, `endpoint`, `method`, `status_code`, `ip`, `user_agent`, `payload_resumo`

Apenas Master pode criar/revogar chaves e ver logs. Função SQL `hash_api_key()` para gerar o hash.

## 2. Edge Function pública `public-api`

Endpoint único e versionado: `/functions/v1/public-api/v1/{recurso}/{id?}`

- Sem JWT (autenticação via header `x-api-key`)
- Valida a chave: hash + ativo + não expirada + tem permissão pro recurso/método
- Registra a chamada em `api_logs` (assíncrono)
- Suporta GET (list/get), POST (create), PATCH (update), DELETE (delete)
- Resposta JSON padronizada: `{ data, error, meta: { count, page } }`
- Paginação via `?page=1&limit=50` (máx 200)
- Filtros via `?fornecedor=eq.X&data_prevista=gte.2026-01-01` (sintaxe PostgREST simplificada)
- CORS aberto para chamadas server-side e browser
- Recursos cobertos (todos): recebimentos, armazenagem, solicitacoes_compras, fornecedores_urgencia, fornecedores_nao_vieram, portaria_registros, veiculos, motoristas, ocorrencias_armazenagem, fluxo_financeiro, valores_descarga, relatorios_mensais

## 3. Edge Function `api-keys-admin`

CRUD das chaves (Master only, com JWT):
- Criar chave → retorna chave em texto puro **uma única vez** (formato `gnd_live_<32 chars>`)
- Revogar/reativar
- Listar com `ultimo_uso` e `total_chamadas`

## 4. UI — Nova página "API & Integrações" (Master only)

Adicionada em `AppLayout` + `PermissoesPage`:

- **Aba Chaves**: criar nova (modal mostra chave 1x com botão copiar), tabela com prefixo + nome + último uso + contador + botões revogar/reativar/excluir
- **Aba Permissões**: ao criar chave, selecionar quais recursos e quais métodos (read/write)
- **Aba Logs**: últimas 100 chamadas com filtro por chave/status
- **Aba Documentação**: exemplos `curl` prontos com a URL base do projeto, lista de endpoints, formato de filtros, paginação e tabela de códigos de erro

## 5. Base para consumir APIs externas

Helper genérico `src/lib/externalApi.ts` + edge function template `external-api-proxy` (comentada) que:
- Lê secret `EXTERNAL_API_URL` + `EXTERNAL_API_KEY` (a adicionar depois quando você indicar o sistema)
- Faz proxy autenticado para evitar expor chaves no frontend
- Pronto pra você plugar SAP/TOTVS/Bling/etc. quando definir

## Detalhes técnicos

- Chave gerada com `crypto.randomUUID()` + prefix `gnd_live_`
- Hash com `crypto.subtle.digest("SHA-256", ...)` na edge function
- Rate limiting **não** será implementado agora (limitação da plataforma)
- Permissões granulares por recurso/método armazenadas em jsonb pra ser flexível
- Logs limpos automaticamente após 30 dias via cron (opcional, pode ser adicionado depois)
- Tudo via Lovable Cloud (sem dependência externa)

## O que NÃO entra nesta entrega

- Webhooks de saída (notificar sistema externo em eventos) — pode ser próxima etapa
- OAuth2 / clientes registrados — API Key resolve seu caso
- SDK JavaScript/Python pronto — só documentação curl/exemplos

Posso seguir com a implementação?
