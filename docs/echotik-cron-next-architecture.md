# Proposta Arquitetural — Próxima Estratégia de Ingestão Echotik

> Data: 2026-03-27  
> Branch: `develop`  
> Base: diagnóstico em `docs/echotik-cron-diagnostics.md`  
> Status: proposta técnica — sem alterações de código ainda

---

## Resumo Executivo

O cron atual funciona. O modelo 1 task × 1 region por invocação é correto para o Vercel e deve ser preservado. O problema não é a granularidade — é o algoritmo de decisão e a ausência de dinamismo operacional.

**O que muda:**

- O algoritmo de seleção da próxima tarefa deixa de ser sequencial fixo e passa a ser baseado em staleness normalizado ("quem está mais defasado roda primeiro").
- Os parâmetros operacionais chave deixam de estar hardcoded e passam a ser lidos de `lib/settings.ts`.
- A observabilidade ganha um ponto de consulta mínimo: uma query SQL e um endpoint admin para verificar defasagem por task × região.

**O que não muda:**

- 1 task × 1 region por invocação.
- Cron a cada 15 minutos no Vercel.
- Regiões lidas da tabela `Region` (dinâmico, banco de dados).
- `IngestionRun` como registro de auditoria e base do skip logic.
- Logger estruturado com `runId`.
- Autenticação por `CRON_SECRET`.
- Modularidade por arquivo de sync.

**Complexidade adicionada: mínima e justificada.**  
Não há tabela nova. Não há worker separado. Não há fila externa. A mudança é na lógica de `detectNextTask` e na leitura de alguns parâmetros via settings.

---

## Etapa 1 — Diagnóstico Resumido da Estratégia Atual

### O que funciona bem hoje

| Aspecto                             | Por que está correto                                     |
| ----------------------------------- | -------------------------------------------------------- |
| 1 task × 1 region por invocação     | Respeita o limite de 60 s do Vercel sem arriscar timeout |
| Regiões da tabela `Region`          | Dinâmico, sem env var, auto-adapta a novas regiões       |
| `IngestionRun` como skip logic      | Idempotente, auditável, resiste a reexecução             |
| Logger com `runId`                  | Rastreabilidade completa da cadeia de sync               |
| Upsert idempotente em todos os sync | Reiniciar da página 1 não gera dados duplicados          |
| Modularidade por arquivo            | Fácil de testar, fácil de evoluir cada entidade          |
| Autenticação CRON_SECRET            | Seguro sem complexidade de sessão                        |

### O que limita escala

| Limitação                                                  | Impacto real                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Algoritmo sequencial fixo (BR sempre antes de US etc.)     | Com N regiões, as últimas regiões da lista ficam sistematicamente mais defasadas |
| Prioridade fixa: categories → videos → products → creators | A tarefa mais defasada nunca sobe na fila automaticamente                        |
| Sem cursor intra-tarefa                                    | Falha no meio reprocessa da página 1 (custo de API, não corretude)               |
| Ciclo cresce linearmente com regiões                       | 10 regiões → ~7,8 h por ciclo; 15 regiões → ~11,5 h                              |
| Parâmetros hardcoded                                       | Mudar intervalo ou número de páginas exige deploy                                |
| Sem alerta em falha silenciosa                             | `IngestionRun` em ERROR não notifica ninguém                                     |

### O que é aceitável manter como está

- Granularidade: 1 task × 1 region — não precisa mudar.
- `IngestionRun` existente — continua sendo o estado principal.
- Todos os arquivos de sync (`syncVideos.ts`, `syncProducts.ts`, `syncCreators.ts`) — a lógica de fetch/upsert está correta.
- Retry no client HTTP (`lib/echotik/client.ts`) — funciona.
- O `details` task rodando como "last resort" — correto, preenche gaps sem bloqueio.

### O que precisa mudar obrigatoriamente

1. **Algoritmo de `detectNextTask`**: de sequencial fixo para staleness-based.
2. **Parâmetros operacionais críticos**: intervalos e páginas devem ser lidos dinamicamente.

### O que pode continuar hardcoded

- Rank fields (`sales`, `views`, `gmv`, `followers`) — estrutural, não operacional.
- Ranking cycles `[1, 2, 3]` — vinculado à API Echotik, não ao modelo de negócio.
- Fallback de regiões `["BR", "US", "JP"]` para dev — só para ambiente vazio.
- Formato das skip keys (`echotik:videos:BR`) — convenção interna.

### O que deveria virar configuração dinâmica

- `VIDEO_TREND_INTERVAL_HOURS` / `PRODUCT_TREND_INTERVAL_HOURS` / `CREATOR_TREND_INTERVAL_HOURS`
- `VIDEO_RANKLIST_PAGES` / `PRODUCT_RANKLIST_PAGES` / `CREATOR_RANKLIST_PAGES`
- `PRODUCT_DETAIL_BATCH_SIZE`
- `PRODUCT_DETAIL_MAX_AGE_DAYS`
- Enable/disable por task (para pausar criadores sem parar vídeos, por exemplo)

---

## Etapa 2 — Proposta de Nova Estratégia Operacional

### Recomendação de algoritmo de scheduling

**Hybrid: priority tiers + next-most-stale-first dentro de cada tier.**

Não é round-robin puro (não garante prioridade de entidades), não é priority queue global (perde fairness entre regiões), não é weighted (complexidade desnecessária).

A abordagem híbrida preserva a semântica de negócio atual (categorias primeiro, depois ranklists, depois details) e adiciona fairness automática dentro de cada tier.

### Como funciona o novo algoritmo

```
Tier 0: categories
  → se stale (now - lastSuccess > intervalHours), roda agora.

Tier 1: ranklist tasks (videos, products, creators) × todas as regiões ativas
  → enumera todos os combos ativos: {videos:BR, videos:US, products:BR, ...}
  → para cada combo, calcula staleness_score = (agora - última_execução_SUCCESS) / intervalo_esperado
  → combos nunca executados têm staleness_score = ∞
  → executa o combo com maior staleness_score
  → tie-break: menor sortOrder da região (prioridade editorial preservada)

Tier 2: details
  → sempre proposto se Tier 0 e Tier 1 não precisam rodar
```

**Vantagens:**

- Regiões novas entram automaticamente com staleness = ∞ (máxima prioridade).
- Regiões inativas são ignoradas (não entram na enumeração).
- Sem starvation: nenhum combo fica para sempre no final da fila.
- Preserva a prioridade de entidades configurável: se você quiser que `videos` tenha intervalo menor que `creators`, ele naturalmente ganha o slot com mais frequência.
- Funciona para qualquer N regiões sem mudança de código.

### Como lidar com regiões novas

Regiões com `isActive=true` e sem nenhum `IngestionRun` têm staleness = ∞ automaticamente. Elas sobem na fila imediatamente. Não é necessária nenhuma configuração adicional.

### Como lidar com regiões inativas

Regiões com `isActive=false` não entram na enumeração do Tier 1. O `getConfiguredRegions()` já filtra. Nenhuma mudança necessária.

### Como lidar com backlog

Backlog de details (muitos produtos sem detalhes) é tratado pelo `PRODUCT_DETAIL_BATCH_SIZE` dinâmico. Se o backlog crescer, aumentar o batch. O Tier 2 roda sempre que os Tiers 0 e 1 están frescos, o que garante drenagem progressiva.

### Como dividir trabalho sem extrapolar 60 segundos

A granularidade atual (1 entidade × 1 região × 3 cycles × 2 fields × N páginas) é o divisor correto. O número de páginas é o único parâmetro que controla diretamente o tempo de execução e deve ser dinamicamente ajustável via settings.

---

## Etapa 3 — Estado e Checkpoint

### Avaliação das opções

| Mecanismo                                    | Vale implementar? | Justificativa                                                                                                                                     |
| -------------------------------------------- | :---------------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cursor intra-tarefa (por página)             |   **Não agora**   | Upsert é idempotente: reiniciar da pág 1 não corrompe dados. O custo de API é real mas baixo. A complexidade da tabela extra não justifica ainda. |
| Watermark temporal (lastSyncedAt por região) |      **Sim**      | É o que alimenta o staleness score. Já existe implicitamente em `IngestionRun`. Extrair como query helper.                                        |
| Tabela separada de `SyncState`               |      **Não**      | `IngestionRun` já cumpre o papel. Uma tabela nova seria duplicação.                                                                               |
| Retry por página menor                       |      **Não**      | O retry no HTTP client já trata falhas transitórias. O retry da unidade task:region já existe via o próximo cron.                                 |
| Retomada do ponto de falha                   |   **Não agora**   | Aumenta complexidade consideravelmente. O problema atual não é falha em página 7 — é scheduling ruim. Resolve o scheduling primeiro.              |
| Checkpoint de execuções em ERROR repetido    |  **Sim (leve)**   | Adicionar `consecutiveFailures` no `IngestionRun` como campo derivado em query, sem coluna nova.                                                  |

### O que implementar: watermark via `IngestionRun`

O `IngestionRun` já tem `endedAt` e `status`. Para o staleness score, basta uma query:

```sql
SELECT source, MAX(endedAt) AS last_success_at
FROM "IngestionRun"
WHERE status = 'SUCCESS'
GROUP BY source
```

Isso retorna o `last_success_at` de cada combo. O novo `detectNextTask` executa essa query uma vez, constrói o mapa de staleness, e seleciona o combo mais defasado por tier.

**Sem tabela nova. Sem coluna nova. Sem migração de schema.**

### O que é excesso de complexidade

- Tabela `SyncCursor` com página corrente por task:region: só vale se o custo de API por reinicialização for material (>20% das chamadas). Hoje não é.
- Worker pattern (HTTP endpoint separado acionado pelo cron como dispatcher): adiciona uma hop de latência e um ponto de falha sem ganho real dentro do Vercel.
- Fila externa (BullMQ, Redis, etc.): incompatível com o Vercel serverless sem add-on pago. Overengineering total para o contexto atual.

### Equilíbrio certo

```
Estado atual correto:
  IngestionRun → auditoria + skip logic (manter)

Adição mínima necessária:
  Query de staleness via IngestionRun (sem schema change)
  Uso do staleness para ordenar a fila no detectNextTask
```

---

## Etapa 4 — Configuração Dinâmica

### O que deve virar configuração agora

| Parâmetro atual                     | Chave proposta em `lib/settings.ts` | Default                                         |
| ----------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `VIDEO_TREND_INTERVAL_HOURS = 24`   | `echotik:interval:videos`           | `24`                                            |
| `PRODUCT_TREND_INTERVAL_HOURS = 24` | `echotik:interval:products`         | `24`                                            |
| `CREATOR_TREND_INTERVAL_HOURS = 24` | `echotik:interval:creators`         | `24`                                            |
| `CATEGORIES_INTERVAL_HOURS = 24`    | `echotik:interval:categories`       | `24`                                            |
| `VIDEO_RANKLIST_PAGES = 10`         | `echotik:pages:videos`              | `10`                                            |
| `PRODUCT_RANKLIST_PAGES = 10`       | `echotik:pages:products`            | `10`                                            |
| `CREATOR_RANKLIST_PAGES = 10`       | `echotik:pages:creators`            | `10`                                            |
| `PRODUCT_DETAIL_BATCH_SIZE = 5`     | `echotik:detail:batch_size`         | `5`                                             |
| `PRODUCT_DETAIL_MAX_AGE_DAYS = 7`   | `echotik:detail:max_age_days`       | `7`                                             |
| _(não existe)_                      | `echotik:tasks:enabled`             | `"categories,videos,products,creators,details"` |

### O que pode continuar fixo

- Rank fields: estrutural da API (`sales`, `views`, `gmv`, `followers`).
- Ranking cycles `[1, 2, 3]`: estrutural da API Echotik.
- Formato das skip keys: convenção interna.
- Fallback de regiões `["BR", "US", "JP"]`: só para dev sem seed.
- Schedule do Vercel (`vercel.json`): infraestrutura, não lógica de negócio.

### Onde guardar

`lib/settings.ts` já existe e já tem suporte a configuração persistida no banco. O pattern é:

```ts
// helpers.ts ou um novo lib/echotik/cron/config.ts
import { getSetting } from "@/lib/settings";

export async function getEchotikConfig() {
  const [
    videoIntervalHours,
    productIntervalHours,
    creatorIntervalHours,
    categoriesIntervalHours,
    videoPages,
    productPages,
    creatorPages,
    detailBatchSize,
    detailMaxAgeDays,
    enabledTasksRaw,
  ] = await Promise.all([
    getSetting("echotik:interval:videos", 24),
    getSetting("echotik:interval:products", 24),
    getSetting("echotik:interval:creators", 24),
    getSetting("echotik:interval:categories", 24),
    getSetting("echotik:pages:videos", 10),
    getSetting("echotik:pages:products", 10),
    getSetting("echotik:pages:creators", 10),
    getSetting("echotik:detail:batch_size", 5),
    getSetting("echotik:detail:max_age_days", 7),
    getSetting(
      "echotik:tasks:enabled",
      "categories,videos,products,creators,details",
    ),
  ]);

  const enabledTasks = new Set(enabledTasksRaw.split(",").map((s) => s.trim()));

  return {
    intervals: {
      categories: categoriesIntervalHours,
      videos: videoIntervalHours,
      products: productIntervalHours,
      creators: creatorIntervalHours,
    },
    pages: {
      videos: videoPages,
      products: productPages,
      creators: creatorPages,
    },
    detail: { batchSize: detailBatchSize, maxAgeDays: detailMaxAgeDays },
    enabledTasks,
  };
}
```

### Como evitar overengineering

- **Não criar painel admin dedicado agora.** Os settings são editáveis diretamente via banco ou pela rota admin existente.
- **Não criar UI de configuração por região.** Parâmetros globais são suficientes na fase atual.
- **Não versionar configurações.** Basta o valor atual. Auditoria é via git/deploy.
- Migrar os parâmetros para settings **um arquivo de cada vez**, preservando os defaults exatos. Sem mudança de comportamento.

---

## Etapa 5 — Compatibilidade com Vercel

### Análise das abordagens possíveis

| Abordagem                                                      |    Viável?     | Motivo                                                                         |
| -------------------------------------------------------------- | :------------: | ------------------------------------------------------------------------------ |
| **Manter 1 task × 1 region por invocação, com seleção melhor** |     ✅ Sim     | É o modelo correto. A mudança é no algoritmo de seleção, não na granularidade. |
| Quebrar por página/lote                                        |  ❌ Não agora  | Aumenta invocações por ciclo sem ganho real. Só vale se pages > 20.            |
| Dispatcher + workers separados                                 |     ❌ Não     | Adiciona latência, ponto de falha e complexidade sem benefício para Vercel.    |
| Jobs em banco (pg-boss, etc.)                                  |     ❌ Não     | Infra adicional. Incompatível com o Vercel serverless.                         |
| **Modelo híbrido: seleção melhor + config dinâmica**           | ✅ Recomendado | Mínima mudança, máximo ganho.                                                  |

### Recomendação explícita

**Manter 1 task × 1 region, com algoritmo de seleção melhorado.** É a única abordagem que:

1. Respeita o limite de 60 s sem risco de timeout.
2. Escala com número de regiões (o algoritmo de staleness já lida com N regiões).
3. Não adiciona infraestrutura.
4. Não muda a interface do cron endpoint (mantém `?task=&region=&force=`).

### Proteção contra timeout

O orquestrador atual não tem proteção de budget de tempo. Adicionar uma guarda simples:

```ts
// No início de runEchotikCron:
const BUDGET_MS = 50_000; // 50s de 60s máximos

// Antes de despachar:
if (Date.now() - start > BUDGET_MS) {
  log.warn("Budget exceeded before task dispatch", {
    elapsed: Date.now() - start,
  });
  return { runId: "", status: "SKIPPED", stats: emptyStats() };
}
```

Isso evita que uma query lenta de staleness consuma tempo do sync.

### Cron como dispatcher/orquestrador

O modelo atual já é correto: o cron route é thin e delega para `runEchotikCron`. Não é necessário criar um endpoint http de worker separado. O cron é ao mesmo tempo dispatcher e executor — o que é adequado para a granularidade atual.

### Com crescimento futuro (> 20 regiões)

Se o número de regiões ultrapassar 20, o ciclo completo vai superar 24 h mesmo com staleness-based scheduling. Nesse cenário, as opções são:

1. Reduzir `maxDuration` para 30s e aumentar cron frequency para cada 5 min.
2. Migrar para Vercel Pro e usar `maxDuration=300s` (executa múltiplas tarefas por invocação).
3. Separar em dois endpoints de cron: `cron/echotik/ranklist` e `cron/echotik/details`.

Nenhuma dessas mudanças é necessária agora. O staleness-based scheduling é suficiente até ~15 regiões.

---

## Etapa 6 — Observabilidade e Operação

### Mínimo necessário para operação real

#### 1. Query de diagnóstico de staleness

```sql
-- Staleness atual por task:region
SELECT
  source,
  MAX(CASE WHEN status = 'SUCCESS' THEN "endedAt" END) AS last_success,
  MAX(CASE WHEN status = 'FAILED'  THEN "endedAt" END) AS last_failure,
  COUNT(CASE WHEN status = 'FAILED' AND "endedAt" > NOW() - INTERVAL '24 hours' END) AS failures_24h,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(CASE WHEN status = 'SUCCESS' THEN "endedAt" END))) / 3600, 1) AS hours_since_success
FROM "IngestionRun"
WHERE source LIKE 'echotik:%'
GROUP BY source
ORDER BY hours_since_success DESC NULLS FIRST;
```

Essa query retorna imediatamente quais combos estão mais defasados. Deve ser a primeira coisa a verificar em incidente.

#### 2. Endpoint admin de diagnóstico

Criar `GET /api/admin/echotik/health` que retorna o resultado da query acima como JSON. Protegido por `requireAdmin()`. Permite dashboard ou alerta externo sem acesso ao banco.

```ts
// Resposta esperada:
{
  "tasks": [
    { "source": "echotik:videos:US", "lastSuccess": "2026-03-27T06:00Z", "hoursSinceSuccess": 4.2, "failures24h": 0 },
    { "source": "echotik:products:JP", "lastSuccess": null, "hoursSinceSuccess": null, "failures24h": 3 },
    // ...
  ],
  "stalestTask": "echotik:products:JP",
  "anyStaleThreshold": 30
}
```

#### 3. Alerta em falha repetida

No `runEchotikCron`, após registrar `FAILED` no `IngestionRun`, verificar se o mesmo `source` falhou N vezes nas últimas 24h. Se sim, emitir um `log.error` com `alert: true` que pode ser capturado por qualquer agregador de logs (Datadog, Logtail, etc.).

```ts
// Após marcar FAILED:
const recentFailures = await prisma.ingestionRun.count({
  where: {
    source: runSource,
    status: "FAILED",
    startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});
if (recentFailures >= 3) {
  runLog.error("Repeated ingestion failure — investigation required", {
    source: runSource,
    recentFailures,
    alert: true,
  });
}
```

#### 4. Log de backlog de details

No início do `runDetails`, logar quantos produtos/vídeos estão na fila de enriquecimento pendente:

```ts
const pendingDetails = await prisma.echotikVideo.count({
  where: { productDetailId: null },
});
log.info("Details backlog", { pendingDetails });
```

### O que não implementar agora

- Dashboard visual: overkill para o volume atual.
- Métricas de latência por página: útil, mas não urgente. Logs estruturados já contêm `durationMs`.
- Alertas via e-mail/Slack internos: pode ser feito via integração de log aggregator sem mudança de código.

---

## Etapa 7 — Plano de Migração

### Fase 1 — Configuração dinâmica (sem mudança de comportamento)

**Objetivo:** Externalizar parâmetros hardcoded para `lib/settings.ts` com os mesmos defaults atuais.

**O que muda:**

- Criar `lib/echotik/cron/config.ts` com `getEchotikConfig()`.
- Substituir leitura de constantes hardcoded nos arquivos de sync e no orchestrator por chamada ao config.
- Constantes em `types.ts` ficam como defaults de fallback apenas.

**Validação:** `npm run build` + `npm run test:all` passam. Comportamento operacional idêntico.

**Risco:** Zero. Defaults são os mesmos valores.

**Pode rodar em paralelo com a produção atual:** Sim, imediatamente.

---

### Fase 2 — Staleness-based scheduling

**Objetivo:** Substituir o algoritmo sequencial fixo de `detectNextTask` por seleção baseada em staleness normalizado.

**O que muda:**

- `detectNextTask` em `orchestrator.ts` executa uma única query de `MAX(endedAt)` por source.
- Constrói mapa de staleness scores.
- Seleciona o combo mais defasado dentro de cada tier (categories > ranklists > details).
- A assinatura pública de `detectNextTask` não muda.

**Validação:**

- Testes unitários para `detectNextTask` com cenários: tudo fresco, uma região nova, uma região com falha recente, mix de intervalos distintos.
- Observar logs de produção por 2-3 dias: verificar que todas as regiões rodam em frequência similar.

**Risco:** Baixo. O pior caso é um combo ganhar prioridade "errada" — que se autocorrige na próxima invocação. Não há risco de corrupção de dados.

**Pode rodar em paralelo:** Não é possível A/B (1 instância de cron), mas pode ser ativado com `?task=auto` explícito via teste manual antes de ir para produção.

---

### Fase 3 — Observabilidade

**Objetivo:** Adicionar o endpoint `/api/admin/echotik/health` e o log de backlog.

**O que muda:**

- Novo arquivo `app/api/admin/echotik/health/route.ts`.
- Alerta de falha repetida em `orchestrator.ts` (3 linhas).
- Log de backlog em `runDetails` (2 linhas).

**Validação:** Testes de endpoint admin. Verificar resposta com regiões reais.

**Risco:** Zero. Somente leitura + logs.

---

### Fase 4 — Proteção de budget de tempo

**Objetivo:** Adicionar guarda de 50 s antes do dispatch no `runEchotikCron`.

**O que muda:** 5 linhas em `orchestrator.ts`.

**Validação:** Testar com mock de Date.now() que avança além do budget.

---

### Fase 5 — (opcional, futuro) Cursor intra-tarefa

**Condição para ativar:** Somente se produção mostrar falhas recorrentes em páginas intermediárias OU se o custo de API por reinicialização se tornar material (>10% do total de chamadas).

**O que muda:** Adicionar coluna `lastPage INT` em `IngestionRun` (ou tabela separada `SyncCursor`). Modificar loop de páginas nos sync files para iniciar em `lastPage + 1` se existir cursor.

**Risco:** Médio. Mudança de schema + lógica de retomada. Fazer somente quando necessário.

---

### Como validar que a nova estratégia é melhor

Após ativar a Fase 2, verificar por 7 dias:

```sql
-- Distribuição de execuções por região (deve ser uniforme)
SELECT
  source,
  COUNT(*) AS runs,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successes,
  AVG(EXTRACT(EPOCH FROM ("endedAt" - "startedAt"))) AS avg_duration_s
FROM "IngestionRun"
WHERE source LIKE 'echotik:%'
  AND "startedAt" > NOW() - INTERVAL '7 days'
GROUP BY source
ORDER BY source;
```

Expectativa: nenhuma região deve ter `runs` significativamente menor que outra para o mesmo task type.

---

## Etapa 8 — Entrega Consolidada

### Algoritmo de decisão — pseudocódigo

```
async function detectNextTask(force, config):

  // Tier 0: categories
  if force OR staleness("echotik:categories") > config.intervals.categories:
    return { task: "categories", region: null }

  // Carregar staleness de todos os combos ativos
  regions = getConfiguredRegions()
  enabledRanklists = ["videos", "products", "creators"].filter(t => config.enabledTasks.has(t))

  combos = []
  for each task in enabledRanklists:
    for each region in regions:
      source = `echotik:${task}:${region}`
      lastSuccess = lastSuccessAt(source)  // from IN memory map loaded once
      expectedInterval = config.intervals[task]
      staleness = lastSuccess ? (now - lastSuccess) / (expectedInterval * 3600_000) : Infinity
      combos.push({ task, region, staleness, sortOrder: region.sortOrder })

  // Tier 1: pick most stale combo
  staleCombo = combos
    .filter(c => force OR c.staleness > 1.0)  // > 1.0 = passou do intervalo
    .sort by (staleness DESC, sortOrder ASC)
    [0]

  if staleCombo:
    return { task: staleCombo.task, region: staleCombo.region }

  // Tier 2: details (always last resort)
  if config.enabledTasks.has("details"):
    return { task: "details", region: null }

  return null
```

**Query para lastSuccessAt (carregada uma vez, não N queries):**

```ts
const rows = await prisma.ingestionRun.groupBy({
  by: ["source"],
  where: { status: "SUCCESS", source: { startsWith: "echotik:" } },
  _max: { endedAt: true },
});
const lastSuccessMap = new Map(rows.map((r) => [r.source, r._max.endedAt]));
```

Isso substitui as N chamadas de `shouldSkip` por uma única query com GROUP BY.

---

### Proposta de configurações dinâmicas

| Chave em `lib/settings.ts`    | Default                                         | Quando ajustar                                          |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `echotik:interval:categories` | `24` (h)                                        | Categorias mudam pouco — pode aumentar para 168 h       |
| `echotik:interval:videos`     | `24` (h)                                        | Reduzir para 12 h em regiões prioritárias se necessário |
| `echotik:interval:products`   | `24` (h)                                        | Idem                                                    |
| `echotik:interval:creators`   | `24` (h)                                        | Pode ser 48 h sem impacto                               |
| `echotik:pages:videos`        | `10`                                            | Reduzir se timeout, aumentar se cobertura insuficiente  |
| `echotik:pages:products`      | `10`                                            | Idem                                                    |
| `echotik:pages:creators`      | `10`                                            | Idem                                                    |
| `echotik:detail:batch_size`   | `5`                                             | Aumentar se backlog crescer muito                       |
| `echotik:detail:max_age_days` | `7`                                             | Aumentar para reduzir custo de API                      |
| `echotik:tasks:enabled`       | `"categories,videos,products,creators,details"` | Desativar task durante incidente                        |

---

### Compatibilidade com Vercel — resumo

| Restrição                   | Abordagem                                                       |
| --------------------------- | --------------------------------------------------------------- |
| `maxDuration = 60s`         | 1 task × 1 region, páginas ajustáveis via settings              |
| Cron a cada 15 min          | Suficiente para até ~15 regiões com intervalo de 24 h           |
| Sem estado entre invocações | `IngestionRun` no banco como estado externo                     |
| Sem worker thread           | Cron é dispatcher e executor — correto para granularidade atual |
| Timeout em query lenta      | Budget guard de 50 s antes do dispatch                          |

---

### Observabilidade mínima recomendada

| Ponto                                | Implementação                        | Quando           |
| ------------------------------------ | ------------------------------------ | ---------------- |
| Staleness query                      | SQL sobre `IngestionRun`             | Já possível hoje |
| `/api/admin/echotik/health`          | Novo endpoint admin                  | Fase 3           |
| Alerta de falha repetida (≥3 em 24h) | `log.error` com `alert: true`        | Fase 3           |
| Backlog de details                   | `log.info` no início de `runDetails` | Fase 3           |

---

### Plano de migração em fases

| Fase | O que muda                                 | Risco | Pode rodar paralelo?      |
| ---- | ------------------------------------------ | ----- | ------------------------- |
| 1    | Config dinâmica via `lib/settings.ts`      | Zero  | Sim                       |
| 2    | Staleness-based `detectNextTask`           | Baixo | Não (1 instância de cron) |
| 3    | Observabilidade: health endpoint + alertas | Zero  | Sim                       |
| 4    | Budget guard de 50 s                       | Zero  | Sim                       |
| 5\*  | Cursor intra-tarefa                        | Médio | Não — schema change       |

\*Fase 5 somente se produção demonstrar necessidade.

**Sequência recomendada:** Fase 1 → Fase 4 → Fase 3 → Fase 2

Começar pela configuração dinâmica (sem mudança de comportamento) garante que, quando o algoritmo mudar na Fase 2, os parâmetros já sejam ajustáveis sem deploy.

---

### Riscos e Trade-offs

| Risco                                                   | Probabilidade | Mitigação                                                                  |
| ------------------------------------------------------- | :-----------: | -------------------------------------------------------------------------- |
| Staleness query GROUP BY lenta com muitos IngestionRuns |     Baixa     | Adicionar índice em `(source, status, endedAt)` se necessário              |
| Nova seleção prioriza tarefa inesperada                 |     Baixa     | Monitorar distribuição de execuções por 7 dias após ativação               |
| Settings não populados (DB vazio)                       |  Improvável   | Todos os `getSetting` têm default igual ao valor atual hardcoded           |
| Fase 2 quebra testes existentes de `detectNextTask`     |   Possível    | Atualizar mocks para retornar `IngestionRun` com timestamps realistas      |
| Crescimento além de 15 regiões                          |  Médio prazo  | Plano já documentado: reduzir `maxDuration` ou aumentar frequência do cron |

---

### O que não está nesta proposta (e por quê)

| Descartado                                               | Motivo                                                |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Fila externa (Redis, BullMQ)                             | Incompatível com Vercel serverless sem add-on pago    |
| Dispatcher + workers separados                           | Complexidade sem ganho para o volume atual            |
| Cursor intra-tarefa imediato                             | Upsert idempotente elimina o risco de dados; custo só |
| Configuração por região (intervalos diferentes por país) | Overengineering; uma configuração global é suficiente |
| Dashboard visual dedicado                                | Qualquer agregador de logs já supre o health endpoint |
| Schema change imediato                                   | Não é necessário para nenhuma das Fases 1-4           |
