# AI-DLC Audit Log

> CRITICAL: This file is append-only. Never overwrite — only append new entries.

---

## Workspace Detection
**Timestamp**: 2026-07-10T00:00:00Z
**User Input**: "Conversa com o Gemini [...] The Global Inception Prompt — Initiate the Inception Phase (Reverse Engineering) for this entire brownfield repository."
**AI Response**: Initiated AI-DLC workflow. Detected brownfield project. Proceeding with Workspace Detection + Reverse Engineering.
**Context**: INCEPTION PHASE — Workspace Detection stage initiated. Rule files loaded from `.aidlc-rule-details/`.

---

## Reverse Engineering — Start
**Timestamp**: 2026-07-10T00:01:00Z
**User Input**: (Automatic continuation from Workspace Detection — brownfield detected, no prior aidlc-docs found)
**AI Response**: Scanning entire repository. Generating all reverse engineering artifacts.
**Context**: INCEPTION PHASE — Reverse Engineering stage initiated.

---

## Workflow Planning + Code Generation Planning — Complete
**Timestamp**: 2026-07-10T00:10:00Z
**User Input**: "aproove and continue"
**AI Response**: Requirements approved. Execution plan created. Code generation plan created for unit notification-reset-on-open. Proceeding to execute.
**Context**: INCEPTION PHASE complete. CONSTRUCTION PHASE — Code Generation starting.

---

## Requirements Analysis — Complete
**Timestamp**: 2026-07-10T00:08:00Z
**User Input**: "done" (all 5 questions answered: Q1=A, Q2=A, Q3=A, Q4=A, Q5=A)
**AI Response**: Requirements document generated. Extensions enabled: Security Baseline, Resiliency Baseline, Property-Based Testing (full). Awaiting user approval.
**Context**: INCEPTION PHASE — Requirements Analysis complete.

---

## Requirements Analysis — Start
**Timestamp**: 2026-07-10T00:06:00Z
**User Input**: "using ai dlc review the notification module. when the icon is clicked the number of notifications should reset and then start again from new ones"
**AI Response**: Initiated Requirements Analysis. Created requirement-verification-questions.md. Awaiting user answers before generating requirements document.
**Context**: INCEPTION PHASE — Requirements Analysis stage initiated.

---

## Reverse Engineering — Complete
**Timestamp**: 2026-07-10T00:05:00Z
**User Input**: (Awaiting user review)
**AI Response**: Generated 8 reverse engineering artifacts in aidlc-docs/inception/reverse-engineering/. Awaiting user approval before proceeding to Requirements Analysis.
**Context**: INCEPTION PHASE — Reverse Engineering stage complete. Waiting for explicit user approval.

---

## Reverse Engineering — Rerun Requested (Update)
**Timestamp**: 2026-08-06T00:00:00Z
**User Input**: "using ai dlc updaye the reverse-engineering"
**AI Response**: User explicitly requested a rerun of Reverse Engineering. Per workspace-detection.md Step 3, explicit user request triggers rerun regardless of staleness. Loading existing artifacts (2026-07-10) and re-scanning the codebase to refresh all reverse engineering documents.
**Context**: INCEPTION PHASE — Reverse Engineering stage re-initiated (update/refresh of existing artifacts).

---

## Reverse Engineering — Refresh Complete
**Timestamp**: 2026-08-06T00:30:00Z
**User Input**: (Awaiting user review)
**AI Response**: Re-analyzed the codebase on branch `develop` @ `87e524b` (419 source files, 42 Prisma models, 93 API route handlers) and regenerated all 9 reverse engineering artifacts in aidlc-docs/inception/reverse-engineering/. Documented the new Shopee vertical (2 models, 7 lib modules, 9 components, 2 pages, 5 API routes, 2 cron entries, 8 runtime settings) and the build-time `prisma migrate deploy` change. Corrected three errors carried from the 2026-07-10 run: Prisma model count (27 -> 42), cron HTTP method (POST -> GET), and migration timing. Recorded four verified defects in code-quality-assessment.md: `ShopeeAchadinhoProduct.category` never written, missing PENDING->READY approval transition, two dead exported functions, and a non-transactional ranking rebuild. Awaiting user approval.
**Context**: INCEPTION PHASE — Reverse Engineering refresh complete. Waiting for explicit user approval.

---

## Defect Remediation #1 — ShopeeAchadinhoProduct.category never populated
**Timestamp**: 2026-08-06T01:00:00Z
**User Input**: "let fix each defects one by one"
**AI Response**: Fixed defect #1. Root cause was twofold: (a) `saveProductResult()` in lib/shopee/pipeline.ts never wrote the `category` field, and (b) `mapShopeeCategories()` only did an exact-match keyword lookup, which can never match a GPT-extracted product name. Added `resolveCategoryFromText()` to lib/shopee/shopee-categories.ts (exact match, then longest-first substring match), routed the existing fallback through it, and made the pipeline resolve and persist `category` from `offer.productCatIds` with the product name as fallback. Guarded the write so a reprocess cannot null out a previously resolved value. Added __tests__/lib/shopee/shopee-categories.test.ts (16 tests) — the first test file for the Shopee module. Typecheck clean; full suite 1052 tests passing.
**Context**: CONSTRUCTION PHASE — defect remediation, item 1 of 7.

---

## Defect Remediation #2 + #3 + Vercel timeout hardening
**Timestamp**: 2026-08-06T02:00:00Z
**User Input**: "go ahead to the next" / [AskUserQuestion answer: "Full approval gate (as commented)"] / "btw make sure the job can run without timout from vercel. there are set of vercel skills in this project you can consult"
**AI Response**: Consulted .agents/skills/vercel-react-best-practices (the only Vercel skill present); its server-after-nonblocking rule does not apply because after() work still counts toward function maxDuration.
DEFECT #2 (approval gate) — implemented per user's choice: public feed now requires status READY; the ?status param is honored only for ADMIN so users cannot escape the gate; category list respects the same visibility; PATCH /api/shopee/achadinhos/[id] accepts action approve|reject|reset with PROCESSING/FAILED refused as 409; added REJECTED status; admin tab gained Approve/Reject buttons and a corrected fetch (?status=all&pageSize=1000 — it previously read only the first 24 records); added prisma/approveAchadinhos.ts for the pre-gate backlog.
DEFECT #3 (dead code) — resolved as part of the restructure: processAchadinhoVideoFast merged into a single canonical processAchadinhoVideo; buscarVideosAchadinhosShopee removed with its orphaned interface and import.
TIMEOUT — root cause: two-phase design transcribed all videos in memory and persisted nothing until phase 2, so a kill discarded all paid Whisper work; worst-case single video ~230s against a 300s ceiling. Replaced with processAchadinhosBatch: per-video persistence, explicit time budget with worst-case reservation, discovery sub-budget, resumability by skipping already-processed videos (FAILED honors a 24h cooldown), and partial-run reporting. shouldSkipShopeeTask now ignores partial runs so the cooldown cannot freeze a backlog.
Verification: typecheck clean; 1086 tests / 83 files passing, including 23 new gate tests and 11 new budget/resumability tests.
**Context**: CONSTRUCTION PHASE — defect remediation, items 2 and 3 of 7, plus platform-timeout hardening.

---

## Design Decision — Shopee cron job split (deferred)
**Timestamp**: 2026-08-06T02:30:00Z
**User Input**: "think about maybe turnng the job into two. one saves the videos and triger oder to fill missing information or something better." / [AskUserQuestion answer: "Keep single job for now"]
**AI Response**: Analysed splitting the achadinhos cron into a producer (discovery) + worker (enrichment) pair, noting the codebase already uses this pattern for VideoTranscript via /api/cron/transcribe. Recommended going further: stage-aware worker (DISCOVERED/TRANSCRIBED/EXTRACTED), views-desc priority ordering instead of FIFO, a lease on PROCESSING, and folding in the status enum. Estimated >10x useful compute/day. User elected to DEFER: the budget + resumability fix already removes the timeout, and real IngestionRun stats should inform the decision before restructuring. Proceeding to defects #4-#7 on the single-job design.
**Context**: CONSTRUCTION PHASE — architecture decision recorded, not implemented. Revisit when run statistics are available.

---

## Defect Remediation #4 — non-transactional ranking rebuild
**Timestamp**: 2026-08-06T02:45:00Z
**User Input**: (continuation of "let fix each defects one by one")
**AI Response**: Fixed defect #4 in lib/shopee/client.ts syncShopeeRankings(). Found three problems, not one: (a) an empty API response called deleteMany({}) and wiped the ranking; (b) deleteMany + N upserts ran outside a transaction, so readers could observe an empty/partial ranking and a mid-loop failure left it broken; (c) the outer catch returned 0, which made the cron record SUCCESS and start the 24h cooldown — so a supplier outage both wiped the data and blocked retry for a day. Fixes: never delete without a replacement (throws, preserving current data); atomic deleteMany+createMany in a single $transaction (createMany replaces the N-upsert loop, which could never match a row after the delete anyway); errors now propagate so the IngestionRun is marked FAILED and the next cron retries; added a shrink guard that aborts replacement when keyword failures occurred and the new set is under 50% of the current row count. Added __tests__/lib/shopee/ranking-sync.test.ts (10 tests). Typecheck clean; 1096 tests / 84 files passing.
**Context**: CONSTRUCTION PHASE — defect remediation, item 4 of 7.

---

## Defect Remediation #5, #6, #7 — enum, GraphQL hardening, test coverage
**Timestamp**: 2026-08-06T03:15:00Z
**User Input**: "continue to the next fixes"
**AI Response**:
#5 STATUS ENUM — added ShopeeAchadinhoStatus (PENDING/PROCESSING/READY/FAILED/REJECTED) to schema.prisma with migration 20260806120000_shopee_achadinho_status_enum. Cast is defensive (ELSE 'PENDING') because migrations run inside the Vercel buildCommand and a failed cast aborts the deploy. Typed the API routes, added an isInspectableStatus type guard, and mirrored the union as AchadinhoStatus in lib/swr/useShopee.ts (declared locally to keep @prisma/client out of the browser bundle). The compiler immediately flagged two untyped call sites the String column had allowed silently.
#6 GRAPHQL — added ShopeeApiError; graphqlRequest now throws on transport failure, non-OK HTTP, invalid JSON, and GraphQL envelope errors instead of returning {}. Replaced manual quote-escaping with JSON.stringify-based gqlString (GraphQL string literals follow JSON syntax), covering backslashes, newlines and unicode; sortType/limit coerced and clamped. Did NOT switch to GraphQL variables: the vendor signs the exact payload string and documents inline queries, so that change needs live-credential verification — recorded as a follow-up.
COUPLING FOUND: item #4's shrink guard was inert until #6 landed. graphqlRequest swallowed errors, so searchShopeeProductsGraphQL never threw, so syncShopeeRankings' per-keyword catch never fired and keywordFailures stayed 0.
#7 TESTS — added shopee-api-client.test.ts (22), adapters.test.ts (14), cron-syncShopee.test.ts (12), joining the earlier shopee-categories (16), achadinhos gate (23) and pipeline-budget (11). Shopee module went from 0 tests to 96. Coverage: lib/shopee 80.04% stmts / 92.59% funcs; lib/shopee/cron 96.07% stmts / 100% funcs.
Two test-authoring bugs found and fixed by the tests themselves (a naive injection assertion, and a factory that ignored its overrides) — source code was correct in both cases.
Updated aidlc-docs/inception/reverse-engineering/code-quality-assessment.md with a remediation log and remaining follow-ups.
Verification: typecheck clean; 1144 tests / 87 files passing.
**Context**: CONSTRUCTION PHASE — defect remediation items 5-7 of 7 complete. All seven prioritised items closed (item 7 partially, by design).

---

## Achadinhos backlog approval — blocked on migration, deferred to deploy
**Timestamp**: 2026-08-06T03:40:00Z
**User Input**: "maxDuration = 300 is ok" / "The backlog is still hidden... Run it with --dry-run first do it" / [AskUserQuestion answer: "Deploy first, then approve"]
**AI Response**: maxDuration=300 confirmed correct for this plan; no change to SHOPEE_BUDGET constants. Attempted the read-only dry-run of prisma/approveAchadinhos.ts; it failed with 'type "public.ShopeeAchadinhoStatus" does not exist'. prisma migrate status confirmed 33/34 migrations applied, with only 20260806120000_shopee_achadinho_status_enum pending. This surfaced a required ordering: migrate BEFORE approve. Noted that .env points at a single Neon endpoint (ep-nameless-paper-anvlh1rs) whose environment (preview vs production) is not determinable from the URL, while docs/deploy.md states develop and main use separate databases. User elected to deploy first and approve afterwards against the correct environment. NO database writes were performed — only a failed count() and a read-only migrate status.
OPERATIONAL RISK RAISED: between the migration applying at deploy time and the approval script being run, the public achadinhos feed will be empty, because the gate now requires status READY and all pre-gate records are PENDING.
**Context**: CONSTRUCTION PHASE — data migration deferred to the deploy window. Runbook provided to the user.

---

## Follow-through — migration backfill + tests for remaining untested surfaces
**Timestamp**: 2026-08-06T04:15:00Z
**User Input**: "do the recomendeded"
**AI Response**: Executed both standing recommendations.
MIGRATION BACKFILL — folded the pre-gate backlog publish into migration 20260806120000 (UPDATE ... SET status='READY' WHERE status='PENDING' AND productName IS NOT NULL AND affiliateLink IS NOT NULL), in the same transaction as the enum cast. This removes the empty-feed window between deploy and running the approval script, and removes the per-environment manual step. Safe to edit because the migration is still unapplied everywhere (verified via prisma migrate status). Rationale recorded in the SQL: these records were already publicly visible before the gate, so publishing them preserves the status quo rather than granting new exposure; everything the pipeline produces from here on still requires admin review. prisma/approveAchadinhos.ts was retained and re-documented as an operational tool rather than a required deploy step.
TESTS (recommended order) —
1. __tests__/api/cron/shopee.test.ts (20): CRON_SECRET guards incl. fail-closed on missing/empty secret and unequal-length token, non-Vercel 403 block, task routing, force passthrough, count clamping (20..400, non-numeric), error propagation.
2. __tests__/api/admin/shopee-settings.test.ts (15): admin guard on GET and POST, assertion that GET never returns credential values (only the `configured` boolean), credentials routed through upsertSecretSetting not upsertSetting, blank/non-string rejection, achadinhosCount clamping.
3. __tests__/components/shopee/ShopeeAchadinhoCard.test.tsx (11): the "correção crítica" link separation — buy anchor points at the Shopee affiliate URL, no anchor points at tiktok.com, target/rel hardening, edited affiliateLink wins over originalAffLink, admin edit button hidden for USER/anonymous.
4. __tests__/components/shopee/ShopeeAdminTab.test.tsx (9): status=all and high pageSize on load, Approve/Reject visibility per status, PROCESSING/FAILED not reviewable (mirrors the API 409), PATCH body on approve.
5. __tests__/components/shopee/useShopee.test.tsx (14): URL construction incl. empty filters omitted, admin hook requests status=all, mutation bodies and error propagation for both admin mutations.
One test-authoring bug fixed: MUI wraps disabled-capable IconButtons in a span that carries the tooltip aria-label, so the click had to descend to the real button.
Verification: typecheck clean; node suite 1179 tests / 89 files; component suite 113 tests / 11 files. Coverage: app/api/cron/shopee 100% stmts, app/api/admin/settings/shopee 84.84%, lib/shopee 80.04%, lib/shopee/cron 96.07%.
NOTE: lib/swr/useShopee.ts reports 0% in both coverage runs despite having 14 tests — its tests live in the jsdom config, whose coverage include glob is app/components/**, while the node config's glob does not run those tests. A reporting gap, not a coverage gap.
**Context**: CONSTRUCTION PHASE — remediation follow-through complete.

---

## Segunda rodada de remediação — reavaliação com skills
**Timestamp**: 2026-08-07T18:30:00Z
**User Input**: "added new vercel skills and skill that can help do the evaluation of the code again focusing in the shopee features" / lista de decisões: "1 - plain link / 3 - i dont want older videos then that / 4 - so fix it everywhere needed / 5 - sp apply the enrire fix / 6 - so send 10 url do the best aproach / 7 - fix it / 8 - do the best practice aproach and what follows project patther / 9 - also apply best practices / 10 - test what is missing / 11 - drop it for now / 12 - dropt it for now / 13 - do it / 14 - applu best practos / 15 - update ai dlc"
**AI Response**: Reavaliação usando next-best-practices, vercel-react-best-practices e echotik-api-assistant. Aplicado:
(1) LINK DE AFILIADO — decisão de produto: pipeline deixa de assinar links com as credenciais da plataforma (generateShortLink + tag hyppado_achadinhos) e passa a servir o link direto do produto. Antes, o assinante divulgava e a comissão ia para a Hyppado.
(3) GUARDA DE IDADE — mantida em 400 dias por decisão do usuário; o suposto conflito com o retry se dissolve, já que o retry passa a proteger vídeos recentes.
(4)(5) RETRY — isRetryableEnvelopeCode passa a re-tentar qualquer code != 0 (global-rules §10.3, respostas que não consomem cota), não só 500; cacheDownloadUrls.ts do cron EchoTik ganhou retries:4 (mesmo defeito já corrigido no lado Shopee).
(6) CAPAS EM LOTE — signEchotikCoverUrls agrupa 10 URLs por chamada (limite documentado, sem consumo de cota); uploadImages percorre produtos e criadores em blocos. Reduz ~10x o volume de chamadas, que é o gatilho do risk control.
(7)(8) IMAGENS — alinhadas ao padrão do projeto (Box component="img" + loading="lazy" + onError, como VideoCard) em vez de introduzir next/image só no Shopee; removido o <img> cru com eslint-disable; loading="lazy" adicionado em 4 componentes.
(9) MEMOIZAÇÃO — filtered/ordered/paginated do ShopeeAdminTab em useMemo; REVIEW_PRIORITY movido para o escopo do módulo.
(#7 da lista) SWR — ShopeeAdminTab migrado de fetch manual para useShopeeAchadinhos/useReviewAchadinho; testes reescritos para mockar os hooks.
(10) TESTES — __tests__/api/shopee/ranking.test.ts (5) e ShopeeProductCard.test.tsx (4).
(11)(12) video/search e Universal Search — deixados de lado por decisão do usuário.
(13) PR #114 — já estava merged; 0 PRs abertos.
(14) AUTO-DEPLOY — --squash trocado por --merge. O squash fazia main e develop divergirem por construção; o sync main->develop virava merge com risco de conflito e já duplicou hooks, quebrando a produção.
(15) AI-DLC — code-quality-assessment.md atualizado com a segunda rodada, o incidente de produção e as descobertas medidas sobre a API da EchoTik.
NÃO aplicado por decisão do usuário: min_views permanece em 3000.
**Context**: CONSTRUCTION PHASE — segunda rodada de remediação sobre o vertical Shopee.

---

## Investigação — EchoTik `code=429` no ranklist de vídeos
**Timestamp**: 2026-08-10T20:30:00Z
**User Input**: "investigue o erro  429  usando a doc da echotik que temos aqui no projeto entenda os rating limits"
**AI Response**: Investigação concluída sem alteração de código. Registrado em `aidlc-state.md`
sob Deferred Decisions por pedido do usuário ("marque para resolver essa questao dps no ai dlc").
**Context**: Diagnóstico do 429 recorrente que derruba o sync de vídeos de US.

### Natureza do erro
- NÃO é status HTTP. A EchoTik responde HTTP 200 com `code: 429` no corpo. Confirmado pelo
  formato da mensagem: o ramo HTTP produziria `429 Too Many Requests — /path`; o observado é
  `code=429 — /path`, do ramo de envelope em `lib/echotik/client.ts`.
- O cliente já re-tenta qualquer `code != 0` (3 tentativas, backoff exponencial com jitter),
  conforme a regra §10.3 da skill. Um run falho significa três 429 seguidos.

### O que a documentação cobre
- Nada sobre limites. Verificados: referências da skill `echotik-api-assistant`,
  `authentication.md`, `introduction.md`, `echotik/video/ranklist.md` e `llms.txt`.
- Sem códigos de erro, QPS, concorrência, cota ou throttling documentados. Única menção
  quantitativa é comercial ("a partir de ¥0,01 por requisição").
- A regra §10.3 (retry em `code != 0`, requisições falhas não consomem crédito) é escopada a
  endpoints REALTIME. O 429 observado é em endpoint OFFLINE — fora do escopo da regra.

### Evidência empírica
- 85 ocorrências: todas em `videos:US`, todas em `/api/v3/echotik/video/ranklist`.
  Nunca em BR, produtos ou creators.
- Início em 2026-08-09 (uma isolada em 07-27). Antes: 1 execução/dia de US, zero falhas.
  Depois: 08-09 com 3 ok/44 falhas; 08-10 com 0 ok/40 falhas.
- Cada run falho dura 10-16s = 3 tentativas + backoffs → falha na PRIMEIRA requisição,
  não por acúmulo dentro do run.
- Reprodução local com as mesmas credenciais (hashes de `ECHOTIK_USERNAME`/`PASSWORD`
  conferidos entre produção e local): 15 páginas sequenciais de US sem nenhum 429.

### Fatores sob nosso controle
- `echotik:pages:videos = 100` no banco sobrescreve o padrão do código (10). Cada execução =
  3 ciclos × 2 campos × 100 páginas = 600 requisições por região. `echotik:interval:videos = 1`h.
- O laço de páginas do ranklist não tem pausa entre chamadas (~26 req/s medido em produção),
  enquanto a paginação de hashtag espera 2s (`ECHOTIK_PAGE_DELAY_MS`).
- Volume próprio: 34 execuções em 08-07 → 66 em 08-08 → 124 em 08-09.
- Laço de realimentação: em `helpers.ts`, uma falha posterior ao último sucesso faz `shouldSkip`
  ignorar o intervalo, então US é tentado a cada cron (15 min) em vez de 1×/h. O disjuntor
  `hasExcessiveFailures` (5 falhas / 2h) fica quase sempre logo acima do ritmo de US (~2,6/h).

### Conclusão
Limite não documentado do lado da EchoTik. O formato aponta mais para teto de taxa/concorrência
do que para cota de conta, já que as mesmas credenciais de uma origem mais lenta funcionam. É
inferência, não prova — sem documentação nem instrumentação dentro da produção não há como
fechar. Provado: o formato (1ª requisição, só US, só ranklist, desde 08-09) e o nosso volume.

---
