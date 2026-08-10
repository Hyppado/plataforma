# AI-DLC State Tracking

## Project Information
- **Project Name**: Hyppado
- **Project Type**: Brownfield
- **Start Date**: 2026-07-10T00:00:00Z
- **Current Stage**: CONSTRUCTION — Build and Test complete, ready to deploy

## Workspace State
- **Existing Code**: Yes
- **Reverse Engineering Needed**: Re-run completed 2026-08-06 (explicit user request; prior artifacts from 2026-07-10 were stale)
- **Workspace Root**: /Users/eve/Projetos/hyppado
- **Branch analyzed**: `develop` @ `87e524b`

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Stage Progress

### INCEPTION PHASE
- [x] Workspace Detection — Completed 2026-07-10
- [x] Reverse Engineering — Completed 2026-07-10; **refreshed 2026-08-06** (awaiting user approval)
  - **Artifacts Location**: aidlc-docs/inception/reverse-engineering/
  - **Refresh scope**: Shopee vertical (PR #101), build-time Prisma migrations (`c097772`); corrected model count (27 → 42) and cron HTTP methods (POST → GET)
- [x] Requirements Analysis — Completed 2026-07-10
- [ ] Workflow Planning — Pending

> **Note**: the Requirements Analysis artifacts predate the Shopee vertical and have not been revisited in this refresh.

### CONSTRUCTION PHASE
- [x] Code Generation — Shopee defect remediation — Completed 2026-08-06
  - 7 prioritised defects from `code-quality-assessment.md` closed (item 7 partially by design)
  - Vercel function-timeout hardening (budget + resumability)
  - Approval gate (`PENDING → READY`) implemented per user decision
  - `ShopeeAchadinhoStatus` enum + migration `20260806120000` (includes backlog backfill)
  - Shopee test coverage: 0 → 165 tests
- [x] Build and Test — Completed 2026-08-06
  - **Artifacts**: `aidlc-docs/construction/build-and-test/build-and-test-summary.md`
  - Typecheck clean; 1179 node + 113 component tests passing; production build succeeds
- [x] Segunda rodada de remediação — Completed 2026-08-07
  - Link de afiliado passa a ser link direto do produto (decisão de produto)
  - Retry conforme doc EchoTik (qualquer code != 0), em todos os call sites
  - Assinatura de capas em lote (10 por chamada)
  - Imagens alinhadas ao padrão do projeto + lazy loading
  - ShopeeAdminTab migrado para os hooks SWR + memoização
  - Auto-deploy: squash → merge commit (elimina divergência develop/main)
  - Typecheck limpo; 1207 node + 121 component tests passando; build de produção OK

### Deferred Decisions
- **Achadinhos cron split** (producer + staged worker, views-desc priority queue) — analysed,
  deferred pending real `IngestionRun` statistics. Rationale in `audit.md` (2026-08-06T02:30Z).
- **Shopee GraphQL variables** — needs verification against the live vendor API before switching
  away from inline queries.
- **EchoTik `code=429` no ranklist de vídeos** — investigado em 2026-08-10, correção adiada a
  pedido do usuário. Diagnóstico completo em `audit.md` (2026-08-10T20:30Z). Resumo: envelope
  HTTP 200 com `code:429`, exclusivo de `videos:US` em `/api/v3/echotik/video/ranklist`, desde
  2026-08-09. Falha já na 1ª requisição (10-16s = 3 retries + backoff). A EchoTik não documenta
  limite algum. Ações propostas, em ordem de impacto: (1) baixar `echotik:pages:videos` de 100
  para 10-20 — é configuração, não código; (2) espaçar as páginas do ranklist, hoje sem pausa
  nenhuma (~26 req/s) enquanto a paginação de hashtag espera 2s; (3) cooldown exponencial por
  fonte no disjuntor, que hoje exige 5 falhas/2h e é contornado por US a ~2,6 falhas/h;
  (4) perguntar ao suporte da EchoTik o significado do código.

### OPERATIONS PHASE
- [ ] Not started (placeholder)

## Extension Configuration
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis |
| Resiliency Baseline | Yes | Requirements Analysis |
| Property-Based Testing | Yes (Full) | Requirements Analysis |
